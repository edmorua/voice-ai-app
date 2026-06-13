import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";

const execAsync = promisify(exec);

export interface NetworkDevice {
  ip: string;
  mac: string;
  name: string;
  vendor: string;
  isPrivateMac: boolean;
}

// OUI prefix → vendor name (first 3 bytes of MAC, uppercase, no colons)
const OUI_MAP: Record<string, string> = {
  // Apple
  "48F1EB": "Apple", "3C0754": "Apple", "A4C361": "Apple", "F0B479": "Apple",
  "7C6D62": "Apple", "D4619D": "Apple", "F4F15A": "Apple", "98F0AB": "Apple",
  "8C8590": "Apple", "B88D12": "Apple", "ACB589": "Apple", "3C2EFF": "Apple",
  "006171": "Apple", "001EC2": "Apple", "001B63": "Apple", "001F5B": "Apple",
  // Samsung
  "38420B": "Samsung",
  "5476E8": "Samsung", "A8F274": "Samsung", "8C7712": "Samsung",
  "F4F5DB": "Samsung", "CC07AB": "Samsung", "BCF5AC": "Samsung",
  "509EA7": "Samsung", "40B395": "Samsung", "8CC84B": "Samsung",
  "F05A8C": "Samsung", "5C497D": "Samsung", "001599": "Samsung",
  // ASUS
  "382CE5": "ASUS", "107B44": "ASUS", "E03F49": "ASUS", "48D224": "ASUS",
  "AC220B": "ASUS", "BC9746": "ASUS", "F832E4": "ASUS", "74D02B": "ASUS",
  // Xiaomi
  "7C1DD9": "Xiaomi", "F48B32": "Xiaomi", "647C34": "Xiaomi", "A45841": "Xiaomi",
  "5883E8": "Xiaomi", "B0E235": "Xiaomi", "0023C6": "Xiaomi",
  // Google
  "54607E": "Google", "F88FCA": "Google", "3C5AB4": "Google", "A4977A": "Google",
  "94EB2C": "Google", "B4F61C": "Google",
  // Amazon
  "F0272D": "Amazon", "68370A": "Amazon", "0C47C9": "Amazon", "7499BB": "Amazon",
  "A002DC": "Amazon", "FC65DE": "Amazon",
  // Sony
  "0013A9": "Sony", "001A80": "Sony", "30179A": "Sony", "F0B4D2": "Sony",
  "4C218B": "Sony", "9022D6": "Sony",
  // LG
  "CC2D8C": "LG", "A0039E": "LG", "7C1C4E": "LG", "641CC2": "LG",
  "30766F": "LG", "E8F2E2": "LG",
  // Huawei
  "001E10": "Huawei", "003048": "Huawei", "28311C": "Huawei", "4CB16C": "Huawei",
  "5C4CCA": "Huawei", "986CF5": "Huawei", "E8EAA8": "Huawei",
  // Fiberhome (routers)
  "5876AC": "Fiberhome", "4C549A": "Fiberhome", "882DCB": "Fiberhome",
  // TP-Link
  "A42BB0": "TP-Link", "B0487A": "TP-Link", "C46E1F": "TP-Link", "F0A731": "TP-Link",
  "3C461D": "TP-Link", "B4B024": "TP-Link", "5C628B": "TP-Link",
  // Motorola / Lenovo
  "48CBC0": "Motorola", "9C3426": "Motorola", "AC37430": "Lenovo",
  // Raspberry Pi
  "B827EB": "Raspberry Pi", "DCA632": "Raspberry Pi", "E45F01": "Raspberry Pi",
  // Microsoft
  "7845C4": "Microsoft", "000D3A": "Microsoft", "001DD8": "Microsoft",
  // Intel (common in laptops)
  "8C8D28": "Intel", "A0C589": "Intel", "5CF7E6": "Intel", "34029F": "Intel",
  "98548E": "Intel", "F8158C": "Intel", "04D4C4": "Intel", "60F677": "Intel",
  "B87520": "Intel",
};

function lookupVendor(mac: string): { vendor: string; isPrivateMac: boolean } {
  // Locally administered MACs have bit 1 of byte 1 set → random/privacy MAC
  const firstByte = parseInt(mac.split(":")[0], 16);
  if (firstByte & 0x02) {
    return { vendor: "Dispositivo (MAC privada)", isPrivateMac: true };
  }
  const oui = mac.replace(/:/g, "").slice(0, 6).toUpperCase();
  const vendor = OUI_MAP[oui] ?? "Desconocido";
  return { vendor, isPrivateMac: false };
}

function friendlyName(ip: string, vendor: string, isPrivateMac: boolean): string {
  if (ip === "192.168.1.254" || ip.endsWith(".254") || ip.endsWith(".1")) return "Router";
  if (isPrivateMac) return `Teléfono/Tablet (${ip})`;
  switch (vendor) {
    case "Apple":    return `Dispositivo Apple (${ip})`;
    case "Samsung":  return `Samsung (${ip})`;
    case "ASUS":     return `ASUS (${ip})`;
    case "Xiaomi":   return `Xiaomi (${ip})`;
    case "Google":   return `Google (${ip})`;
    case "Amazon":   return `Amazon (${ip})`;
    case "Sony":     return `Sony (${ip})`;
    case "LG":       return `LG (${ip})`;
    case "Huawei":   return `Huawei (${ip})`;
    case "Fiberhome":return `Router Fiberhome (${ip})`;
    case "TP-Link":  return `TP-Link (${ip})`;
    default:         return `Dispositivo (${ip})`;
  }
}

async function getSubnetBase(): Promise<string> {
  try {
    const { stdout } = await execAsync("ip route | grep 'scope link'");
    const match = stdout.match(/(\d+\.\d+\.\d+)\.\d+\/\d+/);
    if (match) return match[1];
  } catch {}
  return "192.168.1";
}

async function pingSweep(base: string): Promise<void> {
  await execAsync(
    `for i in $(seq 1 254); do ping -c1 -W1 -q ${base}.$i >/dev/null 2>&1 & done; wait`,
    { shell: "/bin/bash", timeout: 15000 }
  ).catch(() => {});
}

async function readArpTable(): Promise<{ ip: string; mac: string; live: boolean }[]> {
  const content = await fs.readFile("/proc/net/arp", "utf-8");
  return content
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      return { ip: parts[0], mac: parts[3], live: parts[2] === "0x2" };
    })
    .filter(
      (d) =>
        d.live &&
        d.mac &&
        d.mac !== "00:00:00:00:00:00" &&
        d.ip &&
        d.ip !== "0.0.0.0"
    );
}

export async function GET() {
  try {
    const base = await getSubnetBase();
    await pingSweep(base);
    const raw = await readArpTable();

    // Deduplicate by MAC (keep lowest IP when same MAC appears multiple times)
    const seen = new Map<string, typeof raw[0]>();
    for (const d of raw) {
      const existing = seen.get(d.mac);
      if (!existing) {
        seen.set(d.mac, d);
      }
    }
    const unique = Array.from(seen.values());

    const devices: NetworkDevice[] = unique.map((d) => {
      const { vendor, isPrivateMac } = lookupVendor(d.mac);
      return {
        ip: d.ip,
        mac: d.mac,
        name: friendlyName(d.ip, vendor, isPrivateMac),
        vendor,
        isPrivateMac,
      };
    });

    // Sort: router first, then by IP
    devices.sort((a, b) => {
      if (a.name.startsWith("Router")) return -1;
      if (b.name.startsWith("Router")) return 1;
      return a.ip.localeCompare(b.ip, undefined, { numeric: true });
    });

    return NextResponse.json({ devices, scannedAt: Date.now() });
  } catch (err) {
    console.error("[/api/network/devices]", err);
    const message = err instanceof Error ? err.message : "Error al escanear la red";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
