filepath = r"c:\Users\Zyros RK\Desktop\PartnerCentral-Frontend\src\features\bookings\Bookings.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1):
    if "ctxmenu" in line.lower() or "contextmenu" in line.lower() or "menu" in line.lower():
        if any(term in line.lower() for term in ["li", "button", "ul", "span", "div"]):
            print(f"Line {i}: {line.strip()}")
