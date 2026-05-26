filepath = r"c:\Users\Zyros RK\Desktop\PartnerCentral-Frontend\src\features\bookings\Bookings.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1):
    if "escortesia" in line.lower() or "rates." in line.lower():
        # print with ascii conversion to avoid cp1252 encode errors
        print(f"Line {i}: {line.strip().encode('ascii', 'replace').decode('ascii')}")
