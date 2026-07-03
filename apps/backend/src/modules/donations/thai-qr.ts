import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";

type TlvField = {
  tag: string;
  value: string;
};

function encodeField(tag: string, value: string) {
  if (!/^\d{2}$/.test(tag)) throw new Error(`Invalid Thai QR tag: ${tag}`);
  if (value.length > 99) throw new Error(`Thai QR tag ${tag} is too long`);
  return `${tag}${String(value.length).padStart(2, "0")}${value}`;
}

function parseFields(payload: string): TlvField[] {
  const fields: TlvField[] = [];
  let offset = 0;

  while (offset < payload.length) {
    if (offset + 4 > payload.length) throw new Error("Incomplete Thai QR field");
    const tag = payload.slice(offset, offset + 2);
    const lengthText = payload.slice(offset + 2, offset + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lengthText)) {
      throw new Error("Invalid Thai QR TLV data");
    }

    const length = Number(lengthText);
    const valueStart = offset + 4;
    const valueEnd = valueStart + length;
    if (valueEnd > payload.length) throw new Error(`Incomplete Thai QR tag ${tag}`);

    fields.push({ tag, value: payload.slice(valueStart, valueEnd) });
    offset = valueEnd;
  }

  return fields;
}

function crc16Ccitt(value: string) {
  let crc = 0xffff;
  for (const character of Buffer.from(value, "utf8")) {
    crc ^= character << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function setAdditionalReference(value: string, reference: string) {
  const fields = parseFields(value).filter((field) => field.tag !== "05");
  const referenceField = { tag: "05", value: reference.slice(0, 25) };
  const insertAt = fields.findIndex((field) => Number(field.tag) > 5);
  if (insertAt === -1) fields.push(referenceField);
  else fields.splice(insertAt, 0, referenceField);
  return fields.map((field) => encodeField(field.tag, field.value)).join("");
}

function hasMerchantAccount(fields: TlvField[]) {
  return fields.some((field) => {
    const tag = Number(field.tag);
    return tag >= 26 && tag <= 51;
  });
}

export function createFixedAmountThaiQr(basePayload: string | undefined, amount: number, reference: string) {
  if (!basePayload?.trim()) {
    throw new ServiceUnavailableException("Payment QR is not configured");
  }
  if (!Number.isInteger(amount) || amount < 1 || amount > 20_000) {
    throw new BadRequestException("Donation amount must be between 1 and 20000 THB");
  }

  const normalized = basePayload.replace(/\s+/g, "");
  let fields: TlvField[];
  try {
    fields = parseFields(normalized);
  } catch {
    throw new ServiceUnavailableException("Payment QR configuration is invalid");
  }

  const crcField = fields.at(-1);
  if (crcField?.tag !== "63" || crcField.value.length !== 4) {
    throw new ServiceUnavailableException("Payment QR configuration has no valid CRC");
  }
  const sourceWithoutCrc = normalized.slice(0, -8);
  if (crc16Ccitt(`${sourceWithoutCrc}6304`) !== crcField.value.toUpperCase()) {
    throw new ServiceUnavailableException("Payment QR configuration failed CRC validation");
  }
  if (!hasMerchantAccount(fields)) {
    throw new ServiceUnavailableException("Payment QR configuration has no merchant account");
  }

  const result = fields.filter((field) => field.tag !== "54" && field.tag !== "63");
  const pointOfInitiation = result.find((field) => field.tag === "01");
  if (pointOfInitiation) pointOfInitiation.value = "12";
  else result.splice(1, 0, { tag: "01", value: "12" });

  const additionalData = result.find((field) => field.tag === "62");
  if (additionalData) additionalData.value = setAdditionalReference(additionalData.value, reference);
  else result.push({ tag: "62", value: encodeField("05", reference.slice(0, 25)) });

  const amountField = { tag: "54", value: amount.toFixed(2) };
  const currencyIndex = result.findIndex((field) => field.tag === "53");
  if (currencyIndex >= 0) result.splice(currencyIndex + 1, 0, amountField);
  else {
    const countryIndex = result.findIndex((field) => field.tag === "58");
    result.splice(countryIndex >= 0 ? countryIndex : result.length, 0, amountField);
  }

  const body = result.map((field) => encodeField(field.tag, field.value)).join("");
  const payloadForCrc = `${body}6304`;
  return `${payloadForCrc}${crc16Ccitt(payloadForCrc)}`;
}

export function verifyThaiQrPayload(payload: string) {
  const normalized = payload.replace(/\s+/g, "");
  const fields = parseFields(normalized);
  const crcField = fields.at(-1);
  if (crcField?.tag !== "63" || crcField.value.length !== 4) return false;
  return crc16Ccitt(normalized.slice(0, -4)) === crcField.value.toUpperCase();
}

export function thaiQrRecipientValues(payload: string) {
  const normalized = payload.replace(/\s+/g, "");
  const fields = parseFields(normalized);
  const values = new Set<string>();
  for (const field of fields) {
    const tag = Number(field.tag);
    if (tag < 26 || tag > 51) continue;
    try {
      for (const nested of parseFields(field.value)) {
        if (nested.tag === "00") continue;
        const value = nested.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
        if (value.length >= 4) values.add(value);
      }
    } catch {
      const value = field.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      if (value.length >= 4) values.add(value);
    }
  }
  return [...values];
}
