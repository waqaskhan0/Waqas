import os
import re
import subprocess
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


WORKSHEETS = (
    "RWHU_Inventory",
    "Stationary_Inventory",
    "Progressive_Inventory",
)


def load_env(env_path: Path) -> dict[str, str]:
    values: dict[str, str] = {}

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()

    return values


def col_to_index(col: str) -> int:
    result = 0
    for ch in col:
        if ch.isalpha():
            result = result * 26 + (ord(ch.upper()) - 64)
    return result - 1


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def normalize_sku(value: str) -> str:
    cleaned = normalize_spaces(value).replace(" - ", "-").replace("- ", "-").replace(" -", "-")
    return cleaned.upper()


def infer_unit(item_name: str, item_type: str) -> str:
    haystack = f"{item_name} {item_type}".lower()
    if "kg" in haystack or "kilogram" in haystack:
        return "kg"
    if "litre" in haystack or "liter" in haystack:
        return "pcs"
    return "pcs"


def infer_reorder_level(stock: float, status: str) -> float:
    lowered = (status or "").lower()
    if "out of stock" in lowered:
        return 5
    if "restock needed" in lowered:
        return max(5, stock + 3)
    return max(5, round(stock * 0.25, 2))


def parse_workbook(path: Path) -> list[dict[str, object]]:
    ns_main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    ns_rel = "http://schemas.openxmlformats.org/package/2006/relationships"

    with zipfile.ZipFile(path) as zf:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in root.findall(f"{{{ns_main}}}si"):
                text = "".join(
                    node.text or "" for node in si.iterfind(f".//{{{ns_main}}}t")
                )
                shared_strings.append(text)

        workbook = ET.fromstring(zf.read("xl/workbook.xml"))
        rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels.findall(f"{{{ns_rel}}}Relationship")}

        rows: list[dict[str, object]] = []
        seen_skus: set[str] = set()

        for sheet in workbook.findall(f".//{{{ns_main}}}sheet"):
            sheet_name = sheet.attrib["name"]
            if sheet_name not in WORKSHEETS:
                continue

            rid = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            target = rel_map[rid]
            sheet_path = f"xl/{target}" if not target.startswith("xl/") else target
            sheet_root = ET.fromstring(zf.read(sheet_path))

            for row in sheet_root.findall(f".//{{{ns_main}}}sheetData/{{{ns_main}}}row"):
                values: dict[int, str] = {}

                for cell in row.findall(f"{{{ns_main}}}c"):
                    ref = cell.attrib.get("r", "")
                    match = re.match(r"([A-Z]+)", ref)
                    idx = col_to_index(match.group(1)) if match else len(values)
                    cell_type = cell.attrib.get("t")

                    if cell_type == "s":
                        node = cell.find(f"{{{ns_main}}}v")
                        value = shared_strings[int(node.text)] if node is not None and node.text else ""
                    elif cell_type == "inlineStr":
                        value = "".join(
                            text.text or "" for text in cell.iterfind(f".//{{{ns_main}}}t")
                        )
                    else:
                        node = cell.find(f"{{{ns_main}}}v")
                        value = node.text if node is not None and node.text else ""

                    values[idx] = value

                sku = normalize_sku(values.get(0, ""))
                item_name = normalize_spaces(values.get(1, ""))
                item_type = normalize_spaces(values.get(2, ""))
                stock_raw = normalize_spaces(values.get(3, ""))
                status = normalize_spaces(values.get(5, ""))

                if not sku or sku == "ITEM ID" or not re.search(r"[A-Z0-9]", sku):
                    continue
                if not item_name:
                    continue
                if not re.fullmatch(r"-?\d+(?:\.\d+)?", stock_raw):
                    continue
                if sku in seen_skus:
                    continue

                stock = float(stock_raw)
                seen_skus.add(sku)
                rows.append(
                    {
                        "sku": sku,
                        "item_name": item_name,
                        "specification": item_type if item_type and item_type != "NA" else None,
                        "unit": infer_unit(item_name, item_type),
                        "quantity_on_hand": round(stock, 2),
                        "reorder_level": infer_reorder_level(stock, status),
                    }
                )

        return rows


def sql_quote(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    escaped = str(value).replace("\\", "\\\\").replace("'", "''")
    return f"'{escaped}'"


def build_sql(items: list[dict[str, object]]) -> str:
    values = []
    for item in items:
        values.append(
            "("
            + ", ".join(
                [
                    sql_quote(item["sku"]),
                    sql_quote(item["item_name"]),
                    sql_quote(item["specification"]),
                    sql_quote(item["unit"]),
                    sql_quote(item["quantity_on_hand"]),
                    sql_quote(item["reorder_level"]),
                ]
            )
            + ")"
        )

    return """
INSERT INTO inventory_stock (
  sku,
  item_name,
  specification,
  unit,
  quantity_on_hand,
  reorder_level
)
VALUES
{values}
ON DUPLICATE KEY UPDATE
  item_name = VALUES(item_name),
  specification = VALUES(specification),
  unit = VALUES(unit),
  quantity_on_hand = VALUES(quantity_on_hand),
  reorder_level = VALUES(reorder_level);
""".strip().format(values=",\n".join(values))


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python src/scripts/import_inventory_workbook.py <workbook-path>")
        return 1

    workbook_path = Path(sys.argv[1]).expanduser()
    if not workbook_path.exists():
        print(f"Workbook not found: {workbook_path}")
        return 1

    backend_root = Path(__file__).resolve().parents[2]
    env_values = load_env(backend_root / ".env")
    items = parse_workbook(workbook_path)

    if not items:
        print("No inventory rows were found in the workbook.")
        return 1

    sql = build_sql(items)
    env = os.environ.copy()
    env["MYSQL_PWD"] = env_values.get("MYSQL_PASSWORD", "")

    result = subprocess.run(
        [
            "mysql",
            "-h",
            env_values["MYSQL_HOST"],
            "-P",
            env_values.get("MYSQL_PORT", "3306"),
            "-u",
            env_values["MYSQL_USER"],
            env_values["MYSQL_DATABASE"],
        ],
        input=sql,
        text=True,
        env=env,
        capture_output=True,
    )

    if result.returncode != 0:
        sys.stderr.write(result.stderr)
        return result.returncode

    print(f"Imported {len(items)} stock items from {workbook_path.name}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
