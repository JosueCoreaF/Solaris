filepath = r"c:\Users\Zyros RK\Desktop\PartnerCentral-Frontend\src\features\bookings\Bookings.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1):
    if "grid" in line.lower() or "mousedown" in line.lower() or "pointerdown" in line.lower() or "cell" in line.lower():
        print(f"Line {i}: {line.strip().encode('ascii', 'replace').decode('ascii')}")
