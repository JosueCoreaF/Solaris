filepath = r"c:\Users\Zyros RK\Desktop\PartnerCentral-Backend\src\routes\bookings.ts"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1):
    if "date" in line.lower() or "now" in line.lower() or "today" in line.lower():
        print(f"Line {i}: {line.strip()}")
