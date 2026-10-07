// netlify/functions/lookup-mst.js

export default async (req) => {
  // ==============================
  // CORS
  // ==============================
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  };

  // ==============================
  // OPTIONS
  // ==============================
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers,
    });
  }

  // ==============================
  // Chỉ cho phép GET
  // ==============================
  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Method not allowed",
      }),
      {
        status: 405,
        headers,
      },
    );
  }

  // ==============================
  // Lấy MST
  // ==============================
  const url = new URL(req.url);
  const tax = (url.searchParams.get("mst") || "").trim();

  if (!tax) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Thiếu mã số thuế (mst)",
      }),
      {
        status: 400,
        headers,
      },
    );
  }

  // ==============================
  // Validate MST
  // ==============================
  const cleanTax = tax.replace(/[-\s]/g, "");

  if (!/^\d{10}(\d{3})?$/.test(cleanTax)) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Mã số thuế không hợp lệ",
      }),
      {
        status: 400,
        headers,
      },
    );
  }

  // ==============================
  // Kết quả cuối cùng
  // ==============================
  const merged = {
    taxCode: cleanTax,
    name: "",
    address: "",
    phone: "",
    represent: "",
    status: "",
  };

  // API nào cung cấp dữ liệu nào
  const fieldSource = {
    taxCode: "",
    name: "",
    address: "",
    phone: "",
    represent: "",
    status: "",
  };

  // ==============================
  // DEBUG
  // ==============================
  const debug = {
    mst: cleanTax,

    invoy: {
      attempted: false,
      status: null,
      statusText: "",
      success: false,
      response: null,
      error: null,
    },

    vietqr: {
      attempted: false,
      status: null,
      statusText: "",
      success: false,
      response: null,
      error: null,
    },

    xinvoice: {
      attempted: false,
      status: null,
      statusText: "",
      success: false,
      response: null,
      error: null,
    },
  };

  // ==============================
  // Helper
  // ==============================

  function isValidValue(value) {
    return value !== undefined && value !== null && String(value).trim() !== "";
  }

  function cleanValue(value) {
    if (!isValidValue(value)) {
      return "";
    }

    return String(value).trim();
  }

  function setField(field, value, source, force = false) {
    const cleaned = cleanValue(value);

    if (!cleaned) {
      return;
    }

    // Chỉ ghi đè nếu:
    // 1. Chưa có dữ liệu
    // 2. Hoặc force = true
    if (!merged[field] || force) {
      merged[field] = cleaned;
      fieldSource[field] = source;
    }
  }

  function parseJSON(text) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  // ==============================
  // 1. INVoy
  // ==============================
  try {
    debug.invoy.attempted = true;

    const response = await fetch(
      `https://invoy.io.vn/api/v1/public/lookup-mst?mst=${encodeURIComponent(cleanTax)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          Referer: "https://invoy.io.vn/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        },
      },
    );

    debug.invoy.status = response.status;
    debug.invoy.statusText = response.statusText;

    const rawText = await response.text();

    // Giới hạn debug để tránh response quá lớn
    debug.invoy.response = rawText.slice(0, 5000);

    if (!response.ok) {
      debug.invoy.error = `Invoy HTTP ${response.status} ${response.statusText}`;

      console.log("Invoy failed:", response.status, response.statusText);
    } else {
      const data = parseJSON(rawText);

      if (data) {
        debug.invoy.success = true;

        console.log("Invoy data:", data);

        // Invoy trả root object:
        // {
        //   name,
        //   taxCode,
        //   address,
        //   phone,
        //   represent,
        //   status
        // }

        setField("taxCode", data.taxCode, "invoy", true);

        setField("name", data.name, "invoy", true);

        setField("address", data.address, "invoy", true);

        setField("phone", data.phone, "invoy", true);

        setField("represent", data.represent, "invoy", true);

        setField("status", data.status, "invoy", true);
      } else {
        debug.invoy.error = "Invoy trả về JSON không hợp lệ";
      }
    }
  } catch (error) {
    debug.invoy.error = error?.message || String(error);

    console.error("Invoy error:", error);
  }

  // ==============================
  // 2. VIETQR
  // ==============================
  try {
    debug.vietqr.attempted = true;

    const response = await fetch(
      `https://api.vietqr.io/v2/business/${encodeURIComponent(cleanTax)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      },
    );

    debug.vietqr.status = response.status;
    debug.vietqr.statusText = response.statusText;

    const rawText = await response.text();

    debug.vietqr.response = rawText.slice(0, 5000);

    if (!response.ok) {
      debug.vietqr.error = `VietQR HTTP ${response.status} ${response.statusText}`;

      console.log("VietQR failed:", response.status, response.statusText);
    } else {
      const result = parseJSON(rawText);

      if (result && result.data) {
        debug.vietqr.success = true;

        const data = result.data;

        console.log("VietQR data:", data);

        // VietQR:
        // data.id
        // data.name
        // data.address
        // data.status

        // VietQR chỉ bổ sung nếu Invoy chưa có
        setField("taxCode", data.id || data.taxCode, "vietqr");

        setField("name", data.name, "vietqr");

        setField("address", data.address, "vietqr");

        setField("phone", data.phone, "vietqr");

        setField(
          "represent",
          data.represent || data.legalRepresentative,
          "vietqr",
        );

        setField("status", data.status, "vietqr");
      } else {
        debug.vietqr.error = "VietQR không có dữ liệu doanh nghiệp";
      }
    }
  } catch (error) {
    debug.vietqr.error = error?.message || String(error);

    console.error("VietQR error:", error);
  }

  // ==============================
  // 3. XINVOICE
  // ==============================
  try {
    debug.xinvoice.attempted = true;

    const response = await fetch(
      `https://api.xinvoice.vn/gdt-api/tax-payer/${encodeURIComponent(cleanTax)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      },
    );

    debug.xinvoice.status = response.status;
    debug.xinvoice.statusText = response.statusText;

    const rawText = await response.text();

    debug.xinvoice.response = rawText.slice(0, 5000);

    if (!response.ok) {
      debug.xinvoice.error = `XInvoice HTTP ${response.status} ${response.statusText}`;

      console.log("XInvoice failed:", response.status, response.statusText);
    } else {
      const result = parseJSON(rawText);

      if (result) {
        debug.xinvoice.success = true;

        console.log("XInvoice data:", result);

        // ==========================
        // XInvoice có thể có nhiều
        // cấu trúc response khác nhau.
        // Tìm data nếu có.
        // ==========================

        const data = result.data || result.result || result.taxPayer || result;

        if (data && typeof data === "object") {
          // Các tên field có thể gặp
          const name =
            data.name ||
            data.taxpayerName ||
            data.taxPayerName ||
            data.companyName ||
            data.businessName;

          const address =
            data.address ||
            data.taxpayerAddress ||
            data.taxPayerAddress ||
            data.companyAddress;

          const phone =
            data.phone || data.phoneNumber || data.telephone || data.mobile;

          const represent =
            data.represent ||
            data.representative ||
            data.legalRepresentative ||
            data.legalRepresentativeName ||
            data.owner ||
            data.ownerName;

          const status = data.status || data.taxStatus;

          const taxCode = data.taxCode || data.taxcode || data.mst || data.id;

          // ==========================
          // XInvoice chỉ bổ sung
          // những trường còn thiếu
          // ==========================

          setField("taxCode", taxCode, "xinvoice");

          setField("name", name, "xinvoice");

          setField("address", address, "xinvoice");

          setField("phone", phone, "xinvoice");

          setField("represent", represent, "xinvoice");

          setField("status", status, "xinvoice");
        }
      } else {
        debug.xinvoice.error = "XInvoice trả về JSON không hợp lệ";
      }
    }
  } catch (error) {
    debug.xinvoice.error = error?.message || String(error);

    console.error("XInvoice error:", error);
  }

  // ==============================
  // Đảm bảo MST luôn có giá trị
  // ==============================
  if (!merged.taxCode) {
    merged.taxCode = cleanTax;
    fieldSource.taxCode = "input";
  }

  // ==============================
  // Kiểm tra có dữ liệu hay không
  // ==============================
  const hasData =
    !!merged.name ||
    !!merged.address ||
    !!merged.phone ||
    !!merged.represent ||
    !!merged.status;

  // ==============================
  // Xác định các nguồn đã thành công
  // ==============================
  const successfulSources = [];

  if (debug.invoy.success) {
    successfulSources.push("invoy");
  }

  if (debug.vietqr.success) {
    successfulSources.push("vietqr");
  }

  if (debug.xinvoice.success) {
    successfulSources.push("xinvoice");
  }

  // ==============================
  // Trả kết quả
  // ==============================
  if (hasData) {
    return new Response(
      JSON.stringify(
        {
          success: true,

          source: successfulSources,

          data: merged,

          fieldSource: fieldSource,

          debug: debug,
        },
        null,
        2,
      ),
      {
        status: 200,
        headers,
      },
    );
  }

  // ==============================
  // Cả 3 API đều không có dữ liệu
  // ==============================
  return new Response(
    JSON.stringify(
      {
        success: false,

        message: "Không tìm thấy dữ liệu từ cả 3 nguồn",

        data: merged,

        source: successfulSources,

        fieldSource: fieldSource,

        debug: debug,
      },
      null,
      2,
    ),
    {
      status: 404,
      headers,
    },
  );
};
