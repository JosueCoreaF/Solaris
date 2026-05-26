filepath = r"c:\Users\Zyros RK\Desktop\PartnerCentral-Frontend\src\components\PortalCliente.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1):
    if "isv" in line.lower() or "tasa" in line.lower() or "impuesto" in line.lower() or "1.19" in line:
        print(f"Line {i}: {line.strip()}")
