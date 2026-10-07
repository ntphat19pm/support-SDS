export default async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers,
    });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Method not allowed",
      }),
      {
        status: 405,
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      },
    );
  }

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
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      },
    );
  }

  // ============================================================
  // 1. INVOY
  // ============================================================

  try {
    const response = await fetch(
      `https://invoy.io.vn/api/v1/public/lookup-mst?mst=${encodeURIComponent(tax)}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (response.ok) {
      const data = await response.json();

      console.log("INVOY:", data);

      if (data && data.taxCode) {
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
          }),
          {
            status: 200,
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
          },
        );
      }
    }
  } catch (error) {
    console.error("Invoy API lỗi:", error);
  }

  // ============================================================
  // 2. VIETQR
  // ============================================================

  try {
    const response = await fetch(
      `https://api.vietqr.io/v2/business/${encodeURIComponent(tax)}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (response.ok) {
      const json = await response.json();

      console.log("VIETQR:", json);

      if (json.code === "00" && json.data) {
        const d = json.data;

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
          }),
          {
            status: 200,
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
          },
        );
      }
    }
  } catch (error) {
    console.error("VietQR API lỗi:", error);
  }

  // ============================================================
  // 3. XINVOICE
  // ============================================================

  try {
    const response = await fetch(
      `https://api.xinvoice.vn/gdt-api/tax-payer/${encodeURIComponent(tax)}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (response.ok) {
      const json = await response.json();

      console.log("XINVOICE:", json);

      if (
        json &&
        (json.name || json.address || json.legalRepresentative || json.phone)
      ) {
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
          }),
          {
            status: 200,
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
          },
        );
      }
    }
  } catch (error) {
    console.error("XInvoice API lỗi:", error);
  }

  // ============================================================
  // KHÔNG TÌM THẤY
  // ============================================================

  return new Response(
    JSON.stringify({
      success: false,
      source: null,
      message: "Không tìm thấy thông tin mã số thuế",
    }),
    {
      status: 404,
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
    },
  );
};
