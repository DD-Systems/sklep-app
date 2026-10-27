(function (root) {
  "use strict";

  function serialize(products) {
    return JSON.stringify(products, null, 2) + "\n";
  }

  function encode(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    return btoa(binary);
  }

  function decode(content) {
    return new TextDecoder().decode(Uint8Array.from(atob(content.replace(/\s/g, "")), (char) => char.charCodeAt(0)));
  }

  async function blobSha(bytes) {
    const header = new TextEncoder().encode("blob " + bytes.length + "\0");
    const blob = new Uint8Array(header.length + bytes.length);
    blob.set(header);
    blob.set(bytes, header.length);
    const digest = await crypto.subtle.digest("SHA-1", blob);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function validate(products) {
    if (!Array.isArray(products) || products.length > 30) {
      throw new Error("Katalog może zawierać maksymalnie 30 produktów.");
    }
    const ids = new Set();
    for (const product of products) {
      if (!product || typeof product.id !== "string" || !product.id || ids.has(product.id)) {
        throw new Error("Każdy produkt musi mieć własny, unikalny identyfikator.");
      }
      ids.add(product.id);
      if (typeof product.name !== "string" || !product.name.trim()) {
        throw new Error("Uzupełnij nazwę każdego produktu.");
      }
      if (!/^\d+(?:[.,]\d{1,2})?$/.test(String(product.price))) {
        throw new Error("Sprawdź cenę produktu: " + product.name + ".");
      }
      if (product.stock != null && (!Number.isSafeInteger(product.stock) || product.stock < 0)) {
        throw new Error("Sprawdź liczbę sztuk produktu: " + product.name + ".");
      }
    }
  }

  function sameCatalog(left, right) {
    const canonical = (items) => JSON.stringify(items.map((item) => ({
      id: String(item.id), name: String(item.name), price: String(item.price),
      description: String(item.description || ""), image: String(item.image || ""),
      stock: item.stock == null ? 30 : item.stock
    })));
    return canonical(left) === canonical(right);
  }

  function conflict() {
    return new Error("Katalog zmieniono na innym urządzeniu. Zapisz kopię roboczą i wczytaj aktualny katalog przed publikacją.");
  }

  function create({ repository = "DD-Systems/sklep-app", branch = "main", fetch: fetcher = root.fetch.bind(root) } = {}) {
    const repoUrl = "https://api.github.com/repos/" + repository.split("/").map(encodeURIComponent).join("/");
    const contentsPath = "/contents/products.json?ref=" + encodeURIComponent(branch);

    async function request(path, token, options = {}) {
      const headers = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      };
      if (token) headers.Authorization = "Bearer " + token;
      if (options.body) headers["Content-Type"] = "application/json";
      let response;
      try {
        response = await fetcher(repoUrl + path, {
          ...options, headers, cache: "no-store", credentials: "omit",
          redirect: "error", signal: AbortSignal.timeout(30000)
        });
      } catch {
        const error = new Error("Nie udało się połączyć z GitHubem. Sprawdź internet i spróbuj ponownie.");
        error.code = "network";
        throw error;
      }
      if (!response.ok) {
        if (response.status === 409 || response.status === 422) throw conflict();
        const messages = {
          401: "Klucz GitHub wygasł lub jest nieprawidłowy. Połącz konto ponownie.",
          403: "GitHub odrzucił dostęp. Sprawdź limit zapytań oraz uprawnienie Contents: Read and write dla sklepu.",
          404: "Nie znaleziono katalogu lub klucz nie ma dostępu do repozytorium sklep-app."
        };
        throw new Error(messages[response.status] || "GitHub zwrócił błąd " + response.status + ". Spróbuj ponownie później.");
      }
      return response.json();
    }

    async function readCatalog(token = "") {
      const file = await request(contentsPath, token);
      let content = file.content;
      if (!content || file.encoding !== "base64") {
        const blob = await request("/git/blobs/" + file.sha, token);
        content = blob.content;
      }
      const products = JSON.parse(decode(content).replace(/^\uFEFF/, ""));
      validate(products);
      if (!/^[0-9a-f]{40}$/.test(file.sha)) throw new Error("Nie udało się odczytać wersji katalogu.");
      return { products, sha: file.sha };
    }

    async function connect(token) {
      if (!token) throw new Error("Wpisz klucz dostępu do GitHuba.");
      const repo = await request("", token);
      if (!repo.permissions?.push) throw new Error("To konto nie ma prawa do publikowania w repozytorium sklep-app.");
      return readCatalog(token);
    }

    async function publish(products, sha, token) {
      validate(products);
      if (!token) throw new Error("Połącz GitHub przed publikacją.");
      if (!sha) throw new Error("Najpierw wczytaj katalog, aby bezpiecznie opublikować zmiany.");
      const current = await readCatalog(token);
      if (sameCatalog(current.products, products)) return { sha: current.sha, unchanged: true };
      if (current.sha !== sha) throw conflict();
      try {
        const result = await request("/contents/products.json", token, {
          method: "PUT",
          body: JSON.stringify({
            message: "Update products from shop admin",
            branch, sha, content: encode(serialize(products))
          })
        });
        return { sha: result.content.sha, commitUrl: result.commit.html_url };
      } catch (error) {
        if (error.code === "network") {
          try {
            const latest = await readCatalog(token);
            if (sameCatalog(latest.products, products)) return { sha: latest.sha };
          } catch {}
          throw new Error("Nie potwierdzono publikacji. Zachowano zmiany. Ponów publikację, aby sprawdzić wynik.");
        }
        throw error;
      }
    }

    return { readCatalog, connect, publish };
  }

  const api = { create, serialize, blobSha, validate, sameCatalog };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ShopCatalogPublisher = api;
})(globalThis);
