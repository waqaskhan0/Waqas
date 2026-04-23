export const DEPARTMENT_OPTIONS = [
  "Admin",
  "Procurement",
  "Communication",
  "HR",
  "IT",
  "AI",
  "Data Management",
  "Monitoring",
  "Project Management",
  "Finance",
  "Architect"
];

export const LOCATION_OPTIONS = ["Secretariat", "NSR CC", "RWP CC"];

export const TRANSPORT_VEHICLE_OPTIONS = [
  "Car",
  "Hiace",
  "Coaster",
  "Pickup",
  "Loader",
  "Bike",
  "Other"
];

export const TRANSPORT_REQUEST_TYPE_OPTIONS = [
  "Goods Transport",
  "Travel Request",
  "Local Visit / Meeting Transport"
];

const inventoryData = {
  "Water Tank(PVC)": {
    "750 liters": "WTP-750",
    "800 liters": "WTP-800",
    "1000 liters": "WTP-100",
    "1200 liters": "WTP-120",
    "1500 liters": "WTP-150",
    "2000 liters": "WTP- 200"
  },
  "Water Tank(Stainless steel)": {
    "750 liters": "WTS-750",
    "800 liters": "WTS-800",
    "1000 liters": "WTS-100",
    "1200 liters": "WTS-120",
    "1500 liters": "WTS-150",
    "2000 liters": "WTS-200"
  },
  "Coupling socket(Plain socket)": {
    "Coupling Socket 2": "CS-PS2",
    "Coupling Socket 3": "CS-PS3",
    "Coupling Socket 4": "CS-PS4"
  },
  "Reducer Socket(Centric/straight/plain)": {
    "Cent. Reducer Socket 2 x 3": "RS-C23",
    "Cent. Reducer Socket 2 x 4": "RS-C24",
    "Cent. Reducer Socket 3 x 4": "RS-C34"
  },
  "Reducer Socket(Eccentric)": {
    "Eccent. Reducer Socket 2 x 3": "ER-C23",
    "Eccent. Reducer Socket 2 x 4": "ER-C24",
    "Eccent. Reducer Socket 3 x 4": "ER-C34"
  },
  "Elbow 90 Degree (Plain)": {
    "90 Degree Elbow 2": "EP-902",
    "90 Degree Elbow 3": "EP-903",
    "90 Degree Elbow 4": "EP-904"
  },
  "Reducer Elbow 90 Degree": {
    "90 Degree Reducer Elbow 2 x 3": "RE-923",
    "90 Degree Reducer Elbow 2 x 4": "RE-924",
    "90 Degree Reducer Elbow 3 x 4": "RE-934"
  },
  "Elbow 90 Degree with clean out plug": {
    "90 Degree Elbow 2 (with plug)": "ECP-902",
    "90 Degree Elbow 3 (with plug)": "ECP-903",
    "90 Degree Elbow 4 (with plug)": "ECP-904"
  },
  "Elbow 45 Degree (plain)": {
    "45 Degree Elbow 2": "EP-452",
    "45 Degree Elbow 3": "EP-453",
    "45 Degree Elbow 4": "EP-454"
  },
  "Elbow 45 Degree with clean out plug": {
    "45 Degree Elbow 2 (with plug)": "ECP-452",
    "45 Degree Elbow 3 (with plug)": "ECP-453",
    "45 Degree Elbow 4 (with plug)": "ECP-454"
  },
  "Equal Tee/ Plain Tee": {
    "Tee 2": "ET-PT2",
    "Tee 3": "ET-PT3",
    "Tee 4": "ET-PT4"
  },
  "Reducer Tee": {
    "Reducer Tee 2 x 3": "RT-23",
    "Reducer Tee 2 x 4": "RT-24",
    "Reducer Tee 3 x 4": "RT-34"
  },
  "Equal Tee with back port/clean out plug": {
    "Tee 2 (with back plug)": "ET-BP2",
    "Tee 3 (with back plug)": "ET-BP3",
    "Tee 4 (with back plug)": "ET-BP4"
  },
  "Equal Tee with side port/clean out plug": {
    "Tee 2 (with side plug)": "ET-SP2",
    "Tee 3 (with side plug)": "ET-SP3",
    "Tee 4 (with side plug)": "ET-SP4"
  },
  "45 Degree Skew Tee/Y-Tee/Yee": {
    "45 Degree Y-Tee 2": "ST-452",
    "45 Degree Y-Tee 3": "ST-453",
    "45 Degree Y-Tee 4": "ST-454"
  },
  "Plain Cross/Cross Tee": {
    "Plain Cross 2": "PC-T2",
    "Plain Cross 3": "PC-T3",
    "Plain Cross 4": "PC-T4"
  },
  "Reducer Cross": {
    "Reducer Cross 2 x 3": "RC-23",
    "Reducer Cross 2 x 4": "RC-24",
    "Reducer Cross 3 x 4": "RC-34"
  },
  "Y-Cross Double Branch": {
    "Y Cross 2": "YC-DB2",
    "Y Cross 3": "YC-DB3",
    "Y Cross 4": "YC-DB4"
  },
  "Clean-out Plug": {
    "Clean-out 2": "COP-2",
    "Clean-out 3": "COP-3",
    "Clean-out 4": "COP-4"
  },
  "Floor Drain": {
    "Floor Drain 6 x 3": "FD-63",
    "Floor Drain 6 x 4": "FD-64"
  },
  "Roof Drain": {
    "Roof Drain 6 x 3": "RD-63",
    "Roof Drain 6 x 4": "RD-64"
  },
  "End Cap": {
    "End cap 2": "EC-2",
    "End cap 3": "EC-3",
    "End cap 4": "EC-4"
  },
  "PVC Pipes": {
    "2 (SCH-40)": "PVC-240",
    "2 (SDR-41)(B-Class)": "PVC-241",
    "2 (SDR-26)(D-Class)": "PVC-226",
    "3 (SCH-40)": "PVC-340",
    "3 (SDR-41)(B-Class)": "PVC-341",
    "3 (SDR-26)(D-Class)": "PVC-326",
    "4 (SCH-40)": "PVC-440",
    "4 (SDR-41)(B-Class)": "PVC-441",
    "4 (SDR-26)(D-Class)": "PVC-426"
  },
  "Clamps for PVC Pipes": {
    "Clamp 2": "CLM-P2",
    "Clamp 3": "CLM-P3",
    "Clamp 4": "CLM-P4"
  },
  "PVC Solvent Cement/Glue": {
    "Solvent 75 gram Pack": "PSG-75g",
    "Solvent 125 gram Pack": "PSG-125g",
    "Solvent 250 gram Pack": "PSG-250g",
    "Solvent 500 gram Pack": "PSG-500g",
    "Solvent 1000 gram Pack": "PSG-1000g"
  },
  Pallets: {
    "Pallet 39 * 47": "PL-394",
    "Pallet 47 * 47": "PL-474"
  },
  "Thread sealant for GI Pipes and fittings": {
    NA: "TS-GIP"
  },
  "Steel hooks": {
    NA: "ST-HOOK"
  },
  "Steel Nails": {
    NA: "ST-NAL"
  },
  "Plumber's thread": {
    NA: "PL-THR"
  },
  "Plumber's tape/Teflon tape": {
    NA: "PT-TTp"
  },
  "Ash clay bricks": {
    NA: "B-ACB"
  },
  "HH plate": {
    NA: "HH-HPL"
  },
  "User guidelines": {
    NA: "UG-001"
  },
  "GI Fittings": {
    NA: "GI-FTT"
  },
  "Distribution box with power sockets": {
    "16 gauge waterproof": "DB-PS"
  },
  "Electric water cooler": {
    NA: "WC-EWC"
  },
  "Cement-sand mortar and plastered brick platforms": {
    "47 * 47 * 24": "CS-PBP"
  },
  "File Cover / Folders (Blue)": {
    Large: "FC-BUL",
    Small: "FC-BUS"
  },
  "Plastic bag with button / Folder": {
    NA: "PB-BF"
  },
  "File Cover / Folders (Black)": {
    Small: "FC-BLS",
    Large: "FC-BLL"
  },
  "L- shape folder": {
    NA: "ITM-LSF"
  },
  Calculator: {
    NA: "ITM-CAL"
  },
  Stapler: {
    Small: "ITM-SSM",
    Large: "ITM-SLR"
  },
  "UHU Glue Sticks": {
    NA: "GS-UHU"
  },
  "Paper Clips (Black)": {
    NA: "ITM-PCB"
  },
  "Flower paper clip": {
    NA: "ITM-FPC"
  },
  "Binder clips": {
    Large: "ITM-BCL",
    Small: "ITM-BCS"
  },
  "Cushion Tape (Brown)": {
    NA: "ITM-CTB"
  },
  "White Tape": {
    Large: "ITM-WTL",
    Small: "ITM-WTS"
  },
  "Paper Tape": {
    NA: "ITM-PPT"
  },
  "Super Tape": {
    Black: "ITM-STB",
    Red: "ITM-STR"
  },
  "Stamp Pad": {
    Blue: "ITM-SBL",
    Red: "ITM-SRD",
    Green: "ITM-SGR"
  },
  "Steel Scale": {
    NA: "ITM-STS"
  },
  "Dollar Stapler Pins": {
    NA: "IMT-DSP"
  },
  "Sticky notes": {
    Small: "ITM-SNS",
    Large: "ITM-SNL"
  },
  "Dollar Dry Erase Re-filled Marker": {
    Red: "RM-DMR",
    Green: "RM-DMG"
  },
  Pointer: {
    Black: "ITM-PBL"
  },
  "Pencils (LEAD)": {
    NA: "ITM-PLE"
  },
  "Pen Holder": {
    NA: "ITM-PHL"
  },
  "Dollar Permanent Marker": {
    Black: "DM-PBL",
    Blue: "DM-PBU",
    Red: "DM-PRD",
    Green: "DM-PGR"
  },
  Seperators: {
    NA: "ITM-SEP"
  },
  "Account book Register": {
    NA: "ITM-ABR"
  },
  "Correction pen (Whiteners)": {
    NA: "ITM-CPN"
  },
  "Paint Marker": {
    NA: "ITM-PMK"
  },
  Sharpner: {
    NA: "ITM-SHR"
  },
  Eraser: {
    NA: "ITM-ERS"
  },
  "Urdu writing Marker": {
    NA: "ITM-UWM"
  },
  Ballpoint: {
    Blue: "ITM-BBU",
    Black: "ITM-BBL"
  },
  Markers: {
    Black: "ITM-MGR"
  },
  Highlighter: {
    Blue: "ITM-HBU",
    Green: "ITM-HGR",
    Yellow: "ITM-HYL",
    Orange: "ITM-HOR"
  },
  "Stamp pad Ink": {
    Blue: "ITM-IBL",
    Red: "ITM-IRD",
    Green: "ITM-IGR"
  },
  "Graph Pads": {
    NA: "ITM-GPD"
  },
  "Dotted Note Book": {
    NA: "ITM-DNB"
  },
  "Paper Rims": {
    NA: "ITM-PPR"
  },
  "Mitsubishi Uniball eye Pen": {
    Blue: "ITM-MPB",
    Green: "ITM-MPG"
  },
  "Crayon set": {
    NA: "ITM-CRS"
  },
  Planters: {
    "Clay pots": "ITM-PCP",
    Plastic: "ITM-PPL"
  },
  "Planters(for vertical farming)": {
    "Small hanging Plastic": "ITM-PVF"
  },
  "Trees, saplings, plants, and seeds": {
    NA: "ITM-TSP"
  },
  "Garden Hose": {
    NA: "ITM-GHS"
  },
  Wheelbarrow: {
    NA: "ITM-WHB"
  },
  Rack: {
    NA: "ITM-RAK"
  },
  "Hedge Shear": {
    NA: "ITM-HDS"
  },
  "Gardening Fork": {
    NA: "ITM-GDF"
  },
  "Water Can": {
    NA: "ITM-WCN"
  },
  Pruner: {
    NA: "ITM-PRN"
  },
  "Garden Trowel": {
    NA: "ITM-GDT"
  },
  Hoe: {
    NA: "ITM-HOE"
  },
  Apron: {
    small: "ITM-APS",
    large: "ITM-APL"
  },
  Spade: {
    NA: "ITM-SPD"
  },
  Sickle: {
    NA: "ITM-SCK"
  },
  Shovel: {
    NA: "ITM-SHV"
  },
  "Greenhouse shade net": {
    NA: "ITM-GSN"
  },
  Compost: {
    NA: "ITM-COM"
  },
  "GI Gardening Toolbox": {
    NA: "ITM-GGT"
  },
  "Gardening Gloves": {
    NA: "ITM-GGL"
  },
  "Soil mixed with manure (kg)": {
    NA: "ITM-SMM"
  },
  Bench: {
    Yellow: "ITM-BYL"
  },
  Ports: {
    Large: "ITM-PLG",
    Small: "ITM-PSM"
  },
  "Pump motor": {
    NA: "ITM-PMP"
  },
  "Fire extinguisher": {
    NA: "ITM-FIG"
  },
  Ladder: {
    NA: "ITM-LAD"
  },
  "Safety Vest": {
    NA: "ITM-SVT"
  },
  Helmet: {
    White: "ITM-HWT",
    Red: "ITM-HRD",
    Blue: "ITM-HBU"
  },
  "Life jacket": {
    Orange: "ITM-LJO",
    Red: "ITM-LJR",
    Blue: "ITM-LJB"
  },
  Hammer: {
    Small: "ITM-HSM",
    Heavy: "ITM-HHV"
  },
  "Vehicle Rental": {
    Car: "TRN-VRC",
    Hiace: "TRN-VRH",
    Coaster: "TRN-VRT"
  },
  Fuel: {
    Petrol: "TRN-FLP",
    Diesel: "TRN-FLD"
  },
  "Pickup / Loader Service": {
    NA: "TRN-PLS"
  },
  "Driver Services": {
    NA: "TRN-DRS"
  },
  "Bus Booking": {
    NA: "TRN-BBK"
  }
};

const categoryRanges = {
  RWHU: ["Water Tank(PVC)", "Cement-sand mortar and plastered brick platforms"],
  Stationary: ["File Cover / Folders (Blue)", "Crayon set"],
  PROGRESSIVE: ["Planters", "Hammer"],
  Transportation: ["Vehicle Rental", "Bus Booking"]
};

export const SHARED_CATEGORIES = ["Stationary", "PROGRESSIVE", "Transportation"];

export const DEPARTMENT_CATEGORY_ACCESS = {
  Admin: ["RWHU", ...SHARED_CATEGORIES],
  Procurement: ["RWHU", ...SHARED_CATEGORIES],
  Communication: [...SHARED_CATEGORIES],
  HR: [...SHARED_CATEGORIES],
  Finance: ["RWHU", ...SHARED_CATEGORIES],
  "Data Management": ["Stationary", "Transportation"],
  Monitoring: ["Stationary", "Transportation"],
  "Project Management": ["RWHU", ...SHARED_CATEGORIES],
  IT: ["Stationary", "Transportation"],
  AI: ["Stationary", "Transportation"],
  Architect: [...SHARED_CATEGORIES]
};

export function isTransportationCategory(category) {
  return category === "Transportation";
}

export function getAllowedCategories(department) {
  return DEPARTMENT_CATEGORY_ACCESS[String(department ?? "").trim()] ?? SHARED_CATEGORIES;
}

export function getItemsForCategory(category) {
  const keys = Object.keys(inventoryData);
  const range = categoryRanges[category];

  if (!range) {
    return [];
  }

  const startIndex = keys.indexOf(range[0]);
  const endIndex = keys.indexOf(range[1]);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return [];
  }

  return keys.slice(startIndex, endIndex + 1);
}

export function getCategoryInventory(category) {
  return getItemsForCategory(category).reduce((accumulator, itemName) => {
    accumulator[itemName] = inventoryData[itemName];
    return accumulator;
  }, {});
}
