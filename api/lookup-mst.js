export default async function handler(req, res) {
    // ==============================
    // CORS
    // ==============================
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, OPTIONS"
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    // ==============================
    // OPTIONS
    // ==============================
    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    // ==============================
    // Chỉ cho phép GET
    // ==============================
    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            message: "Method not allowed"
        });
    }

    // ==============================
    // Lấy MST
    // ==============================
    const mst = String(req.query.mst || "").trim();

    if (!mst) {
        return res.status(400).json({
            success: false,
            message: "Thiếu mã số thuế. Ví dụ: ?mst=1201305596"
        });
    }

    // ==============================
    // Làm sạch MST
    // ==============================
    const tax = mst.replace(/[-\s]/g, "");

    // ==============================
    // Validate MST
    // ==============================
    if (!/^\d{10}(\d{3})?$/.test(tax)) {
        return res.status(400).json({
            success: false,
            message: "Mã số thuế không hợp lệ",
            mst: tax
        });
    }

    // ==============================
    // URL Invoy
    // ==============================
    const invoyUrl =
        `https://invoy.io.vn/api/v1/public/lookup-mst?mst=${encodeURIComponent(tax)}`;

    console.log("=================================");
    console.log("INVOY TEST");
    console.log("MST:", tax);
    console.log("URL:", invoyUrl);
    console.log("=================================");

    try {
        // ==============================
        // Gọi Invoy
        // ==============================
        const response = await fetch(invoyUrl, {
            method: "GET",
            headers: {
                "Accept": "application/json, text/plain, */*",
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
                "Accept-Language":
                    "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
                "Referer": "https://invoy.io.vn/"
            }
        });

        // ==============================
        // Đọc response dạng text trước
        // ==============================
        const rawText = await response.text();

        console.log("Invoy HTTP status:", response.status);
        console.log("Invoy status text:", response.statusText);
        console.log("Invoy response:", rawText);

        // ==============================
        // Parse JSON nếu có
        // ==============================
        let data = null;

        try {
            data = JSON.parse(rawText);
        } catch (error) {
            data = null;
        }

        // ==============================
        // Thành công
        // ==============================
        if (response.ok) {
            return res.status(200).json({
                success: true,
                invoy: {
                    status: response.status,
                    statusText: response.statusText
                },
                data: data,
                raw: data ? null : rawText
            });
        }

        // ==============================
        // Invoy lỗi HTTP
        // ==============================
        return res.status(200).json({
            success: false,

            message:
                `Invoy trả về HTTP ${response.status} ${response.statusText}`,

            invoy: {
                status: response.status,
                statusText: response.statusText
            },

            data: data,

            // Giữ raw response để xác định
            // có phải Cloudflare hay không
            raw: rawText.slice(0, 10000)
        });

    } catch (error) {
        console.error("Invoy request error:", error);

        return res.status(500).json({
            success: false,

            message: "Không thể gọi Invoy",

            error: error?.message || String(error)
        });
    }
}
```
