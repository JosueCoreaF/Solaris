filepath = r"c:\Users\Zyros RK\Desktop\PartnerCentral-Frontend\src\components\PortalCliente.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1):
    if "isv" in line.lower() or "tasa" in line.lower() or "impuesto" in line.lower() or "1.19" in line or "1.15" in line:
        # print with ascii conversion to avoid cp1252 encode errors
        print(f"Line {i}: {line.strip().encode('ascii', 'replace').decode('ascii')}")
