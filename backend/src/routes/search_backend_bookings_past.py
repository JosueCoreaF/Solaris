filepath = r"c:\Users\Zyros RK\Desktop\PartnerCentral-Backend\src\routes\bookings.ts"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1):
    line_lower = line.lower()
    if "patch" in line_lower or "update" in line_lower or "check_in" in line_lower or "check-in" in line_lower:
        print(f"Line {i}: {line.strip()}")
