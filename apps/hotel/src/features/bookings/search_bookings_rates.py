filepath = r"c:\Users\Zyros RK\Desktop\PartnerCentral-Frontend\src\features\bookings\Bookings.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1):
    if "rates" in line.lower() or "preciobase" in line.lower() or "impuesto" in line.lower():
        if "console" not in line.lower():
            print(f"Line {i}: {line.strip()}")
