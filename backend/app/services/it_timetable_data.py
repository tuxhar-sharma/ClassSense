"""User-supplied transcription of IT_TT_26-27_.pdf; no inferred subject expansions.

Rows use period:subject[#batch][@room], '/' for parallel alternatives and '|'
for successive slots. Faculty names are source labels, not registered accounts.
"""

SOURCE = {
    "title": "BPIT IT Department — Class Timetables 2026–27",
    "document": "IT_TT_26-27_.pdf (user-supplied full transcription, 9 scanned pages)",
    "academic_year": "2026-27", "effective_from": "2026-08-03",
    "issued_on": "2026-07-31", "timezone": "Asia/Kolkata",
    "institute": "Bhagwan Parshuram Institute of Technology, Delhi",
    "signed_by": "PRINCIPAL", "issuer": "Signature; name not legible",
    "notes": [
        "Subject abbreviations are preserved; expansions were not printed.",
        "Lunch is after period IV. 12:50–13:40 is inferred from the surrounding periods.",
        "Missing faculty and rooms are displayed as not specified in the source.",
        "Parallel subjects are shown as alternatives; elective allocation is not explained by the source.",
        "No first-semester timetable was supplied.",
    ],
}

PERIODS = [
    ("I", "09:30", "10:20"), ("II", "10:20", "11:10"),
    ("III", "11:10", "12:00"), ("IV", "12:00", "12:50"),
    ("V", "13:40", "14:30"), ("VI", "14:30", "15:20"),
    ("VII", "15:20", "16:10"), ("VIII", "16:10", "17:00"),
]
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
CODES = {
    3: {"CM": "ES-201", "CM Lab": "ES-251", "DM": "CIC-205",
        "DLCD": "ECC-207", "DLCD Lab": "ECC-253", "DS": "CIC-209",
        "DS Lab": "CIC-255", "OOPS": "CIC-211", "OOPS Lab": "CIC-257",
        "BCM": "BC-181", "BCP": "BC-183"},
    5: {"EE": "HS-301", "CD": "CIC-303", "CD Lab": "CIC-351",
        "OS": "CIC-305", "OS Lab": "CIC-353", "CN": "CIC-307",
        "CN Lab": "CIC-355", "SE": "CIC-309", "SE Lab": "CIC-357",
        "DAA": "CIC-311", "DAA Lab": "CIC-359", "ST-1": "ES-361"},
    7: {"SES": "SE-489", "MSRPM": "SE-483T", "MSRPM Lab": "SE-483P",
        "SVVT": "SE-487T", "SVVT Lab": "SE-487P", "DSR": "DS-427T",
        "DSR Lab": "DS-427P", "BDA": "DS-429T", "BDA Lab": "DS-429P",
        "BI": "DS-431T", "BI Lab": "DS-431P", "DSCC": "CIE-407T",
        "DSCC Lab": "CIE-407P", "WM": "CIE-431T", "WM Lab": "CIE-431P",
        "PEM": "MS-401", "STR-2": "ES-453"},
}

# Theory faculty also teach the corresponding lab unless overridden below.
FACULTY = {
    (3, "A"): {"CM": "Ms. Anuradha Kumari", "DM": "Prof. Seema Kharb", "DLCD": "Dr. Usha Sharma", "DS": "Mr. Sashwat Ranjan Shukla", "OOPS": "Dr. Priyanka Singla", "PDP": "Dr. Reema Chaudhary"},
    (3, "B"): {"CM": "Ms. Anuradha Kumari", "DM": "Prof. Seema Kharb", "DLCD": "Dr. Kriti Dalal", "DS": "Ms. Aditi Dwivedi", "OOPS": "Ms. Neetu", "PDP": "Dr. Reema Chaudhary"},
    (3, "C"): {"CM": "Ms. Yogita Tiwari", "DM": "Ms. Sakshi Agrawal", "DLCD": "Dr. Tanima Ghosh", "DS": "Prof. Manoj Kumar Gupta", "OOPS": "Dr. Pooja Mudgil", "PDP": "Ms. Mehak Talwar"},
    (5, "A"): {"EE": "Ms. Nishtha Bhateja", "CD": "Dr. Shweta Taneja", "OS": "Ms. Rajni Sharma", "CN": "Ms. Anshika Negi", "SE": "Prof. Payal Pahwa", "SE Lab": "Prof. Payal Pahwa / Ms. Rajni Sharma", "DAA": "Dr. Yogita", "PDP": "Ms. Mehak Talwar", "ST-1": "Dr. Madhur Jain, Dr. Shweta Taneja & Mr. Sashwat Ranjan Shukla"},
    (5, "B"): {"EE": "Ms. Nishtha Bhateja", "CD": "Dr. Madhur Jain", "OS": "Dr. Meenakshi Aggarwal", "CN": "Dr. Shailendra Gaur", "SE": "Ms. Anshika Negi", "DAA": "Ms. Sakshi Agrawal", "PDP": "Ms. Mehak Talwar", "ST-1": "Dr. Madhur Jain & Dr. Pooja Mudgil"},
    (5, "C"): {"EE": "Ms. Nishtha Bhateja", "CD": "Dr. Aman Dureja", "OS": "Dr. Ritu Gupta", "CN": "Dr. Shailendra Gaur", "SE": "Dr. Nitish Pathak", "DAA": "Ms. Aditi Dwivedi", "DAA Lab#G1": "Ms. Aditi Dwivedi", "DAA Lab#G2": "Ms. Sakshi Agrawal", "PDP": "Ms. Mehak Talwar", "ST-1": "Dr. Madhur Jain, Dr. Ritu Gupta & Ms. Sakshi Agrawal"},
}
SEVENTH_FACULTY = {"SES": "Ms. Rajni Sharma", "MSRPM": "Dr. Madhur Jain", "SVVT": "Dr. Meenakshi Aggarwal", "DSR": "Dr. Shweta Taneja", "BDA": "Dr. Aman Dureja", "BI": "Dr. Nitish Pathak", "DSCC": "Dr. Yogita", "WM": "Dr. Ritu Gupta", "PEM": "Dr. Rajesh Kumar", "STR-2": "Dr. Shailendra Gaur"}
HOME_ROOMS = {(3, "A"): "301", (3, "B"): "302", (3, "C"): "303", (5, "A"): "SH1-A", (5, "B"): "SH1-B"}

GRIDS = {
    (3, "A"): [
        "1:OOPS|2:DS|3-4:DS Lab#G1@102-C/OOPS Lab#G2@313-B|5:DLCD|6:MMM|7:LIB|8:LIB",
        "1:DLCD|2:CM|3:DM|4:DS|5-6:DLCD Lab#G1@307/CM Lab#G2@102-A|7:BCM@NB102|8:BCP@NB102",
        "1:CM|2:DM|3:OOPS|4:DLCD|5:DS|6:PDP|7:BCM@NB102|8:BCP@NB102",
        "1:OOPS|2:DM|3:LIB|4:CM|5-6:DLCD Lab#G2@307/CM Lab#G1@102-A|7:BCM@NB102|8:BCP@NB102",
        "1-2:DS Lab#G2@102-A/OOPS Lab#G1@313-B|3:DM|4:DS|5:DLCD|6:LIB|7:BCM@NB102|8:BCP@NB102",
    ],
    (3, "B"): [
        "1-2:DS Lab#G1@102-B/OOPS Lab#G2@102-A|3:DS|4:OOPS|5:DM|6:CM|7:MMM|8:LIB",
        "1:DM|2:DLCD|3-4:DS Lab#G2@102-B/OOPS Lab#G1@102-A|5:DS|6:PDP|7:BCM@NB102|8:BCP@NB102",
        "1:OOPS|2:DS|3-4:DLCD Lab#G1@314/CM Lab#G2@102-C|5:CM|6:DLCD|7:BCM@NB102|8:BCP@NB102",
        "1:DS|2:CM|3:DLCD|4:DM|5:LIB|6:LIB|7:BCM@NB102|8:BCP@NB102",
        "1:OOPS|2:DLCD|3:LIB|4:DM|5-6:DLCD Lab#G2@314/CM Lab#G1@102-C|7:BCM@NB102|8:BCP@NB102",
    ],
    (3, "C"): [
        "1:DM|2:DS|3:OOPS|4:CM|5:DLCD|6:MMM|7:LIB|8:LIB",
        "1:OOPS|2:DS|3:DLCD|4:LIB|5-6:DS Lab#G1@102-C/OOPS Lab#G2@102-B|7:BCM@NB102|8:BCP@NB102",
        "1-2:DS Lab#G2@102-A/OOPS Lab#G1@102-B|3:CM|4:DS|5:DM|6:DLCD|7:BCM@NB102|8:BCP@NB102",
        "1:DS|2:DM|3-4:DLCD Lab#G1@307/CM Lab#G2@102-A|5:PDP|6:LIB|7:BCM@NB102|8:BCP@NB102",
        "1:DM|2:CM|3:OOPS|4:DLCD|5-6:DLCD Lab#G2@307/CM Lab#G1@102-A|7:BCM@NB102|8:BCP@NB102",
    ],
    (5, "A"): [
        "1:OS|2:EE|3-4:OS Lab#G2@102-A/DAA Lab#G1@102-B|5:DAA|6:CN|7-8:Enrichment Activities",
        "1-2:CD Lab#G2@102-B/OS Lab#G1@102-C|3:OS|4:SE@220|5:CD|6:DAA|7:LIB|8:Enrichment Activities",
        "1:CN|2:DAA|3:CD|4:SE@220|5-6:CD Lab#G1@102-B/CN Lab#G2@102-C|7-8:Enrichment Activities",
        "1-2:CN Lab#G1@102-A/SE Lab#G2@313-B|3:CD|4:SE@220|5:OS|6:CN|7:PDP|8:MMM",
        "1:OS|2:CN|3:DAA|4:EE|5-6:SE Lab#G1@313-B/DAA Lab#G2@102-B|7-8:Enrichment Activities",
    ],
    (5, "B"): [
        "1:CN|2:SE|3:DAA|4:OS|5-6:OS Lab#G2@102-A/DAA Lab#G1@102-B|7:LIB|8:Enrichment Activities",
        "1-2:SE Lab#G1@102-A/DAA Lab#G2@313-B|3:DAA|4:SE|5:CD|6:EE|7-8:Enrichment Activities",
        "1:OS|2:CN|3:DAA|4:SE|5-6:OS Lab#G1@102-A/CN Lab#G2@313-B|7-8:Enrichment Activities",
        "1:OS|2:EE|3-4:CD Lab#G2@102-C/CN Lab#G1@313-B|5:CN|6:CD|7-8:Enrichment Activities",
        "1:CD|2:CN|3-4:CD Lab#G1@102-C/SE Lab#G2@102-A|5:OS|6:DAA|7:PDP|8:MMM",
    ],
    (5, "C"): [
        "1:OS@R-302|2:CD@R-302|3:CN@R-SH-1A|4:SE@R-SH1-A|5-6:DAA Lab#G1@102-C/CN Lab#G2@313-B|7:LIB|8:PDP@R-SH1-A",
        "1:DAA@R-SH-1A|2:EE@R-SH1-A|3-4:CD Lab#G2@102-C/CN Lab#G1@313-B|5:SE@R-301|6:CD@R-301|7-8:Enrichment Activities",
        "1-2:SE Lab#G2@313-B/CD Lab#G1@102-C|3:EE@R-302|4:CN@R-302|5:OS@R-SH-1A|6:DAA@R-SH-1A|7:Enrichment Activities|8:MMM",
        "1:CN@R-SH1-A|2:OS@R-SH1-A|3:CD@R-SH1-B|4:DAA@R-SH1-B|5-6:OS Lab#G1@102-B/DAA Lab#G2@102-C|7-8:Enrichment Activities",
        "1:SE@R-301|2:DAA@R-301|3-4:OS Lab#G2@102-B/SE Lab#G1@313-B|5:CN@R-SH1-A|6:OS@R-SH1-A|7-8:Enrichment Activities",
    ],
}
SEVENTH_GRID = [
    "1:Minor Project|2:DSCC@304|3-4:DSR Lab#G1@401-B/MSRPM Lab#G1@401-A|5:MSRPM@SH1-B/DSR@404|6:PEM@SH1-B|7-8:BI Lab#G1@401-A/BDA Lab#G2@401-B",
    "1:WM@SH1-B|2:Minor Project|3:PEM@302|4:MSRPM@303/DSR@302|5:SVVT@303/BDA@405|6:SES@303/BI@405|7-8:MSRPM Lab#G2@102-C",
    "1:Minor Project|2:SES@303|3:WM@406|4:DSCC@406|5:SES@402/BI@SH1-B|6:DSCC@SH1-B|7-8:DSCC Lab#G2@401-A/WM Lab#G1@401-B",
    "1:Minor Project|2:SVVT@304/BDA@309|3-4:DSCC Lab#G1@401-A/WM Lab#G2@401-B|5:MSRPM@301/DSR@304|6:SES@303/BI@301|7-8:SVVT Lab#G1@102-A/BI Lab#G2@401-A/BDA Lab#G1@401-B",
    "1:WM@402|2:SVVT@402/BDA@NB301|3-4:SVVT Lab#G2@401-A/DSR Lab#G2@401-B|5:Minor Project|6:Minor Project|7-8:Enrichment Activities",
]
for section in "ABC":
    GRIDS[7, section] = SEVENTH_GRID
    FACULTY[7, section] = SEVENTH_FACULTY
for section in "ABC":
    FACULTY[3, section]["BCM"] = "Mr. Paras Sharma"
