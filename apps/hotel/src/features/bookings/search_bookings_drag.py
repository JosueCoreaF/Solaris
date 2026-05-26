filepath = r"c:\Users\Zyros RK\Desktop\PartnerCentral-Frontend\src\features\bookings\Bookings.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1):
    line_lower = line.lower()
    if any(term in line_lower for term in ["drag", "resize", "mousedown", "mousemove", "mouseup", "handle", "mover", "redimensionar"]):
        print(f"Line {i}: {line.strip()}")
