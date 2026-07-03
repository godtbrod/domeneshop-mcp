/** Thin Domeneshop API client. Holds the SERVER-SIDE credential; users never see it. */

const BASE_URL = "https://api.domeneshop.no/v0";

export interface Domain {
  id: number;
  domain: string;
}

export interface DnsRecord {
  id: number;
  host: string;
  type: string;
  data: string;
  ttl?: number;
  priority?: number;
}

export interface DnsRecordInput {
  host: string;
  type: string;
  data: string;
  ttl?: number;
  priority?: number;
}

export class DomeneshopError extends Error {}

export class Domeneshop {
  readonly #authorization: string;

  constructor(token: string, secret: string) {
    this.#authorization = `Basic ${Buffer.from(`${token}:${secret}`).toString("base64")}`;
  }

  async #request(method: string, path: string, body?: unknown): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: this.#authorization,
          "Content-Type": "application/json",
          "User-Agent": "godtbrod-domeneshop-mcp",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      throw new DomeneshopError(`network error calling Domeneshop: ${String(err)}`);
    }
    const text = await res.text();
    if (!res.ok) {
      throw new DomeneshopError(`Domeneshop ${res.status} for ${method} ${path}: ${text}`);
    }
    return text === "" ? null : (JSON.parse(text) as unknown);
  }

  async listDomains(): Promise<Domain[]> {
    return (await this.#request("GET", "/domains")) as Domain[];
  }

  async domainIdByName(name: string): Promise<number> {
    const domains = await this.listDomains();
    const match = domains.find((d) => d.domain.toLowerCase() === name.toLowerCase());
    if (match === undefined) throw new DomeneshopError(`domain "${name}" not found on this account`);
    return match.id;
  }

  async listDns(domainId: number): Promise<DnsRecord[]> {
    return (await this.#request("GET", `/domains/${domainId}/dns`)) as DnsRecord[];
  }

  async createDns(domainId: number, record: DnsRecordInput): Promise<void> {
    await this.#request("POST", `/domains/${domainId}/dns`, record);
  }

  async updateDns(domainId: number, recordId: number, record: DnsRecordInput): Promise<void> {
    await this.#request("PUT", `/domains/${domainId}/dns/${recordId}`, record);
  }

  async deleteDns(domainId: number, recordId: number): Promise<void> {
    await this.#request("DELETE", `/domains/${domainId}/dns/${recordId}`);
  }
}
