import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
TARGET_SHEETS = {
    "Requests",
    "Transport_Requests",
    "PO",
    "GRN",
    "Request_Records",
    "PO_Records",
}


def col_to_index(col: str) -> int:
    result = 0
    for ch in col:
        if ch.isalpha():
            result = result * 26 + (ord(ch.upper()) - 64)
    return result - 1


def normalize(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def parse_workbook(path: Path) -> dict[str, list[dict[str, str]]]:
    with zipfile.ZipFile(path) as zf:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in root.findall(f"{{{NS_MAIN}}}si"):
                text = "".join(
                    node.text or "" for node in si.iterfind(f".//{{{NS_MAIN}}}t")
                )
                shared_strings.append(text)

        workbook = ET.fromstring(zf.read("xl/workbook.xml"))
        rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        rel_map = {
            rel.attrib["Id"]: rel.attrib["Target"]
            for rel in rels.findall(f"{{{NS_REL}}}Relationship")
        }

        parsed: dict[str, list[dict[str, str]]] = {}

        for sheet in workbook.findall(f".//{{{NS_MAIN}}}sheet"):
            sheet_name = sheet.attrib["name"]
            if sheet_name not in TARGET_SHEETS:
                continue

            rid = sheet.attrib[
                "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
            ]
            target = rel_map[rid]
            sheet_path = f"xl/{target}" if not target.startswith("xl/") else target
            sheet_root = ET.fromstring(zf.read(sheet_path))

            rows: list[list[str]] = []
            for row in sheet_root.findall(
                f".//{{{NS_MAIN}}}sheetData/{{{NS_MAIN}}}row"
            ):
                values: dict[int, str] = {}
                max_idx = -1

                for cell in row.findall(f"{{{NS_MAIN}}}c"):
                    ref = cell.attrib.get("r", "")
                    match = re.match(r"([A-Z]+)", ref)
                    idx = col_to_index(match.group(1)) if match else len(values)
                    max_idx = max(max_idx, idx)
                    cell_type = cell.attrib.get("t")

                    if cell_type == "s":
                        node = cell.find(f"{{{NS_MAIN}}}v")
                        value = shared_strings[int(node.text)] if node is not None and node.text else ""
                    elif cell_type == "inlineStr":
                        value = "".join(
                            text.text or ""
                            for text in cell.iterfind(f".//{{{NS_MAIN}}}t")
                        )
                    else:
                        node = cell.find(f"{{{NS_MAIN}}}v")
                        value = node.text if node is not None and node.text else ""

                    values[idx] = normalize(value)

                if max_idx >= 0:
                    rows.append([values.get(i, "") for i in range(max_idx + 1)])

            if not rows:
                parsed[sheet_name] = []
                continue

            headers = rows[0]
            records: list[dict[str, str]] = []
            for row in rows[1:]:
                record = {
                    normalize(headers[index] if index < len(headers) else f"Column {index + 1}"): row[index]
                    for index in range(max(len(headers), len(row)))
                    if normalize(headers[index] if index < len(headers) else "")
                }
                if any(normalize(value) for value in record.values()):
                    records.append(record)

            parsed[sheet_name] = records

        return parsed


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python extract_workbook_json.py <workbook-path>")
        return 1

    path = Path(sys.argv[1]).expanduser()
    if not path.exists():
        print(f"Workbook not found: {path}", file=sys.stderr)
        return 1

    json.dump(parse_workbook(path), sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
