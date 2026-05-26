filepath = r"c:\Users\Zyros RK\Desktop\PartnerCentral-Frontend\src\features\bookings\Bookings.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1):
    if "editingreserva" in line.lower() and ("input" in line.lower() or "button" in line.lower() or "select" in line.lower() or "disabled" in line.lower()):
        print(f"Line {i}: {line.strip()}")
