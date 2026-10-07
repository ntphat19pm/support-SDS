export default async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // ============================================================
  // CORS PREFLIGHT
  // ============================================================
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers,
    });
  }

  // ============================================================
  // CHỈ CHO PHÉP GET
  // ============================================================
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

  // ============================================================
  // LẤY MST
  // ============================================================
  const url = new URL(req.url);
  const tax = (url.searchParams.get("mst") || "").trim();

  if (!tax) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Thiếu mã số thuế",
      }),
      {
        status: 400,
        headers,
      },
    );
  }

  // ============================================================
  // DEBUG
  // ============================================================
  const debug = {
    mst: tax,
    invoy: {
      attempted: false,
      status: null,
      statusText: "",
      success: false,
      hasTaxCode: false,
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

  // ============================================================
  // 1. INVOY
  // ============================================================
  try {
    debug.invoy.attempted = true;

    const invoyUrl = `https://invoy.io.vn/api/v1/public/lookup-mst?mst=${encodeURIComponent(tax)}`;

    console.log("=================================");
    console.log("INVOY REQUEST");
    console.log("URL:", invoyUrl);

    const response = await fetch(invoyUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });

    debug.invoy.status = response.status;
    debug.invoy.statusText = response.statusText;

    console.log("Invoy status:", response.status);
    console.log("Invoy statusText:", response.statusText);

    const rawText = await response.text();

    console.log("Invoy raw response:", rawText);

    // Giới hạn response debug để tránh trả dữ liệu quá lớn
    debug.invoy.response = rawText.substring(0, 3000);

    if (response.ok) {
      let data = null;

      try {
        data = JSON.parse(rawText);
      } catch (parseError) {
        debug.invoy.error =
          "Response không phải JSON hợp lệ: " + parseError.message;

        console.error("Invoy JSON parse lỗi:", parseError);
      }

      console.log("Invoy parsed data:", data);

      if (data && data.taxCode) {
        debug.invoy.success = true;
        debug.invoy.hasTaxCode = true;

        console.log("✅ INVOY THÀNH CÔNG");

        return new Response(
          JSON.stringify({
            success: true,
            source: "invoy",
            data: {
              taxCode: data.taxCode || tax,
              name: data.name || "",
              address: data.address || "",
              phone: data.phone || "",
              represent: data.represent || "",
              status: data.status || "",
              startDate: data.startDate || "",
              businessType: data.businessType || "",
              taxOffice: data.taxOffice || null,
              businessLine: data.businessLine || null,
              capital: data.capital || null,
            },
            debug,
          }),
          {
            status: 200,
            headers,
          },
        );
      } else {
        debug.invoy.error = "Invoy trả response nhưng không có taxCode.";
      }
    } else {
      debug.invoy.error = `Invoy HTTP ${response.status} ${response.statusText}`;
    }
  } catch (error) {
    debug.invoy.error = error.message || String(error);

    console.error("❌ INVOY FETCH ERROR:", error);
  }

  // ============================================================
  // 2. VIETQR
  // ============================================================
  try {
    debug.vietqr.attempted = true;

    const vietqrUrl = `https://api.vietqr.io/v2/business/${encodeURIComponent(tax)}`;

    console.log("=================================");
    console.log("VIETQR REQUEST");
    console.log("URL:", vietqrUrl);

    const response = await fetch(vietqrUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });

    debug.vietqr.status = response.status;
    debug.vietqr.statusText = response.statusText;

    console.log("VietQR status:", response.status);

    const rawText = await response.text();

    debug.vietqr.response = rawText.substring(0, 3000);

    if (response.ok) {
      let json = null;

      try {
        json = JSON.parse(rawText);
      } catch (parseError) {
        debug.vietqr.error =
          "Response không phải JSON hợp lệ: " + parseError.message;
      }

      console.log("VietQR:", json);

      if (json && json.code === "00" && json.data) {
        const d = json.data;

        debug.vietqr.success = true;

        console.log("✅ VIETQR THÀNH CÔNG");

        return new Response(
          JSON.stringify({
            success: true,
            source: "vietqr",
            data: {
              taxCode: d.taxCode || tax,
              name: d.name || "",
              address: d.address || "",
              phone: d.phone || "",
              represent: d.legalRepresentative || d.represent || "",
            },
            debug,
          }),
          {
            status: 200,
            headers,
          },
        );
      } else {
        debug.vietqr.error = "VietQR không trả dữ liệu hợp lệ.";
      }
    } else {
      debug.vietqr.error = `VietQR HTTP ${response.status} ${response.statusText}`;
    }
  } catch (error) {
    debug.vietqr.error = error.message || String(error);

    console.error("❌ VIETQR FETCH ERROR:", error);
  }

  // ============================================================
  // 3. XINVOICE
  // ============================================================
  try {
    debug.xinvoice.attempted = true;

    const xinvoiceUrl = `https://api.xinvoice.vn/gdt-api/tax-payer/${encodeURIComponent(tax)}`;

    console.log("=================================");
    console.log("XINVOICE REQUEST");
    console.log("URL:", xinvoiceUrl);

    const response = await fetch(xinvoiceUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });

    debug.xinvoice.status = response.status;
    debug.xinvoice.statusText = response.statusText;

    console.log("XInvoice status:", response.status);

    const rawText = await response.text();

    debug.xinvoice.response = rawText.substring(0, 3000);

    if (response.ok) {
      let json = null;

      try {
        json = JSON.parse(rawText);
      } catch (parseError) {
        debug.xinvoice.error =
          "Response không phải JSON hợp lệ: " + parseError.message;
      }

      console.log("XInvoice:", json);

      if (
        json &&
        (json.name || json.address || json.legalRepresentative || json.phone)
      ) {
        debug.xinvoice.success = true;

        console.log("✅ XINVOICE THÀNH CÔNG");

        return new Response(
          JSON.stringify({
            success: true,
            source: "xinvoice",
            data: {
              taxCode: tax,
              name: json.name || "",
              address: json.address || "",
              phone: json.phone || "",
              represent: json.legalRepresentative || "",
            },
            debug,
          }),
          {
            status: 200,
            headers,
          },
        );
      } else {
        debug.xinvoice.error =
          "XInvoice trả response nhưng không có dữ liệu doanh nghiệp.";
      }
    } else {
      debug.xinvoice.error = `XInvoice HTTP ${response.status} ${response.statusText}`;
    }
  } catch (error) {
    debug.xinvoice.error = error.message || String(error);

    console.error("❌ XINVOICE FETCH ERROR:", error);
  }

  // ============================================================
  // KHÔNG TÌM THẤY
  // ============================================================
  return new Response(
    JSON.stringify({
      success: false,
      source: null,
      message: "Không tìm thấy thông tin mã số thuế",
      debug,
    }),
    {
      status: 404,
      headers,
    },
  );
};
