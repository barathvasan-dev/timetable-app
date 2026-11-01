"""First-run timetable (M.Tech IT (AI & DS), Semester I). Edit everything later from the app."""

DEFAULT_META = {
    "program": "M.Tech IT",
    "track": "(AI & DS)",
    "semester": "Semester I",
    "venue": "IST T3 Lecture Hall",
}

DEFAULT_COURSES = [
    {"id": "MA3160", "code": "MA3160", "name": "Probability and Statistical Methods", "fac": "Dr. Vasanthi Beulah", "fam": 0, "lab": False},
    {"id": "IF3151", "code": "IF3151", "name": "Advanced Data Structures and Algorithms", "fac": "Dr. M. Vijayalakshmi", "fam": 1, "lab": False},
    {"id": "IF3151L", "code": "IF3151 Lab", "name": "Advanced Data Structures & Algorithms Lab", "fac": "Dr. M. Vijayalakshmi", "fam": 1, "lab": True},
    {"id": "DS3101", "code": "DS3101", "name": "Fundamentals of Data Science", "fac": "Dr. S. Sridhar", "fam": 2, "lab": False},
    {"id": "DS3101L", "code": "DS3101 Lab", "name": "Fundamentals of Data Science Lab", "fac": "Dr. S. Sridhar", "fam": 2, "lab": True},
    {"id": "DS3102", "code": "DS3102", "name": "Artificial Intelligence", "fac": "Dr. S. Sendhilkumar", "fam": 3, "lab": False},
    {"id": "IF3152", "code": "IF3152", "name": "Advanced Database Management Systems", "fac": "Dr. K. Manimala", "fam": 4, "lab": False},
    {"id": "IF3152L", "code": "IF3152 Lab", "name": "Advanced Database Management Systems Lab", "fac": "Dr. K. Manimala", "fam": 4, "lab": True},
    {"id": "RM3151", "code": "RM3151", "name": "Research Methodology and IPR", "fac": "Dr. P. Yogesh", "fam": 5, "lab": False},
]

DEFAULT_TIMES = [
    {"n": 1, "s": 510, "e": 560}, {"n": 2, "s": 565, "e": 615},
    {"n": 3, "s": 630, "e": 680}, {"n": 4, "s": 685, "e": 735},
    {"n": 5, "s": 790, "e": 840}, {"n": 6, "s": 845, "e": 895},
    {"n": 7, "s": 900, "e": 950}, {"n": 8, "s": 955, "e": 1005},
]

DEFAULT_SLOTS = {
    "Mon-6": "MA3160", "Mon-7": "RM3151", "Mon-8": "IF3152",
    "Tue-2": "DS3101", "Tue-3": "DS3102", "Tue-7": "RM3151",
    "Wed-6": "MA3160", "Wed-7": "RM3151",
    "Thu-2": "DS3102", "Thu-3": "DS3101",
    "Fri-1": "IF3151", "Fri-2": "DS3101", "Fri-3": "DS3102", "Fri-4": "IF3152",
    "Fri-5": "IF3151L", "Fri-6": "DS3101L",
}

DEFAULT_SETTINGS = {
    "whatsapp": {
        "enabled": False,
        "api_version": "v21.0",
        "phone_number_id": "",
        "access_token": "",
        "recipients": [],
    }
}
