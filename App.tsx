import React, { useState, useEffect, useCallback, useRef } from "react";
import { InvoiceData, InvoiceItem, BankDetails } from "./types";
import {
  Trash2,
  Plus,
  Download,
  Printer,
  Save,
  FilePlus,
  Image as ImageIcon,
  FileDown,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const GOLD_COLOR = "#c09c3c";

// Permanent Zeus Logo - path to image file in public folder
const ZEUS_LOGO_PATH = `${import.meta.env.BASE_URL}images/ZeusLogo.jpeg`;
const DEFAULT_SIGNATURE_PATH = `${
  import.meta.env.BASE_URL
}images/Signature.png`;

const DEFAULT_BANK_DETAILS: BankDetails = {
  bankName: "Commercial Bank",
  branch: "Katubedda",
  accountName: "ZEUS TECHNOLOGIES PVT LTD",
  accountNumber: "8023608760",
};

const formatCurrency = (num: number) => {
  return new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const generateInvoiceNumber = () => {
  const prefix = "SS";
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");

  const storedData = localStorage.getItem("zeus_invoice_sequence");
  let sequence = 1;

  if (storedData) {
    const { date, lastSeq } = JSON.parse(storedData);
    if (date === dateStr) {
      sequence = lastSeq + 1;
    }
  }

  localStorage.setItem(
    "zeus_invoice_sequence",
    JSON.stringify({ date: dateStr, lastSeq: sequence })
  );
  return `${prefix}${dateStr}-${sequence.toString().padStart(3, "0")}`;
};

export default function App() {
  const [invoice, setInvoice] = useState<InvoiceData>({
    invoiceNo: "",
    date: new Date().toISOString().split("T")[0],
    customerName: "",
    customerAddress: "",
    items: [
      {
        id: crypto.randomUUID(),
        description: "",
        quantity: 0,
        unit: "",
        rate: 0,
        total: 0,
      },
    ],
    bankDetails: { ...DEFAULT_BANK_DETAILS },
    logo: ZEUS_LOGO_PATH,
    signature: DEFAULT_SIGNATURE_PATH,
    notes: "",
    phone: "071-747-7721",
    email: "sales@zeustechnologies.com",
  });

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Initial load
    const savedLogo = localStorage.getItem("zeus_logo");
    const savedSignature = localStorage.getItem("zeus_signature");

    setInvoice((prev) => ({
      ...prev,
      invoiceNo: generateInvoiceNumber(),
      logo: savedLogo || ZEUS_LOGO_PATH,
      signature: savedSignature || DEFAULT_SIGNATURE_PATH,
    }));
    setIsLoaded(true);
  }, []);

  const handleNewInvoice = () => {
    if (
      confirm(
        "Are you sure you want to create a new invoice? Unsaved changes will be lost."
      )
    ) {
      setInvoice({
        ...invoice,
        invoiceNo: generateInvoiceNumber(),
        date: new Date().toISOString().split("T")[0],
        customerName: "",
        customerAddress: "",
        items: [
          {
            id: crypto.randomUUID(),
            description: "",
            quantity: 0,
            unit: "",
            rate: 0,
            total: 0,
          },
        ],
        logo: ZEUS_LOGO_PATH,
        signature: DEFAULT_SIGNATURE_PATH,
        notes: "",
      });
    }
  };

  const handleSaveDraft = () => {
    localStorage.setItem("zeus_invoice_draft", JSON.stringify(invoice));
    alert("Draft saved to local storage!");
  };

  const handleLoadDraft = () => {
    const draft = localStorage.getItem("zeus_invoice_draft");
    if (draft) {
      const loadedInvoice = JSON.parse(draft);
      // Limit items to maximum 4
      if (loadedInvoice.items && loadedInvoice.items.length > 4) {
        loadedInvoice.items = loadedInvoice.items.slice(0, 4);
      }
      setInvoice(loadedInvoice);
    } else {
      alert("No draft found.");
    }
  };

  const addItem = () => {
    if (invoice.items.length >= 4) {
      alert("Maximum of 4 rows allowed.");
      return;
    }
    setInvoice((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: crypto.randomUUID(),
          description: "",
          quantity: 0,
          unit: "",
          rate: 0,
          total: 0,
        },
      ],
    }));
  };

  const removeItem = (id: string) => {
    if (invoice.items.length > 1) {
      setInvoice((prev) => ({
        ...prev,
        items: prev.items.filter((item) => item.id !== id),
      }));
    }
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setInvoice((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === "quantity" || field === "rate") {
            updated.total = (updated.quantity || 0) * (updated.rate || 0);
          }
          return updated;
        }
        return item;
      }),
    }));
  };

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "signature"
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setInvoice((prev) => ({ ...prev, [type]: base64 }));
        localStorage.setItem(`zeus_${type}`, base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const grandTotal = invoice.items.reduce((sum, item) => sum + item.total, 0);

  const invoiceRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    if (!invoiceRef.current) return;

    try {
      // Wait for all images to load
      const images = invoiceRef.current.querySelectorAll("img");
      await Promise.all(
        Array.from(images).map((img) => {
          const imageElement = img as HTMLImageElement;
          if (imageElement.complete) return Promise.resolve();
          return new Promise((resolve) => {
            imageElement.onload = resolve;
            imageElement.onerror = resolve; // Continue even if image fails
            setTimeout(resolve, 3000); // Timeout after 3 seconds
          });
        })
      );

      // Hide the no-print elements temporarily
      const noPrintElements = document.querySelectorAll(".no-print");
      noPrintElements.forEach((el) => {
        (el as HTMLElement).style.display = "none";
      });

      // Get the full height and width of the content
      const element = invoiceRef.current;
      const originalHeight = element.style.height;
      const originalOverflow = element.style.overflow;

      // Temporarily set to auto to get full height
      element.style.height = "auto";
      element.style.overflow = "visible";

      const fullHeight = element.scrollHeight;
      const fullWidth = element.scrollWidth;

      // Generate canvas from the invoice with full height
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        height: fullHeight,
        width: fullWidth,
        windowWidth: fullWidth,
        windowHeight: fullHeight,
        scrollX: 0,
        scrollY: 0,
      });

      // Restore original styles
      element.style.height = originalHeight;
      element.style.overflow = originalOverflow;

      // Restore no-print elements
      noPrintElements.forEach((el) => {
        (el as HTMLElement).style.display = "";
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = 210;
      const pdfHeight = 297;
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // Calculate dimensions in mm (assuming 96 DPI)
      const mmPerPixel = 25.4 / 96;
      const imgWidthInMm = imgWidth * mmPerPixel * (2 / 2); // Account for scale
      const imgHeightInMm = imgHeight * mmPerPixel * (2 / 2);

      // Calculate ratio to fit width
      const widthRatio = pdfWidth / imgWidthInMm;
      const heightRatio = pdfHeight / imgHeightInMm;
      const ratio = Math.min(widthRatio, heightRatio);

      const finalWidth = imgWidthInMm * ratio;
      const finalHeight = imgHeightInMm * ratio;

      // Handle multi-page if content is taller than one page
      if (finalHeight > pdfHeight) {
        const totalPages = Math.ceil(finalHeight / pdfHeight);
        const pageHeightPx = imgHeight / totalPages;

        for (let i = 0; i < totalPages; i++) {
          if (i > 0) {
            pdf.addPage();
          }

          // Create a canvas for this page slice
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = imgWidth;
          pageCanvas.height = Math.min(
            pageHeightPx,
            imgHeight - pageHeightPx * i
          );
          const ctx = pageCanvas.getContext("2d");

          if (ctx) {
            const sourceImg = new Image();
            sourceImg.src = imgData;
            await new Promise((resolve) => {
              sourceImg.onload = () => {
                const sourceY = pageHeightPx * i;
                const sourceH = Math.min(pageHeightPx, imgHeight - sourceY);
                ctx.drawImage(
                  sourceImg,
                  0,
                  sourceY,
                  imgWidth,
                  sourceH,
                  0,
                  0,
                  imgWidth,
                  sourceH
                );
                resolve(null);
              };
            });

            const pageImgData = pageCanvas.toDataURL("image/png");
            const pageImgHeightInMm =
              pageCanvas.height * mmPerPixel * (2 / 2) * ratio;
            pdf.addImage(
              pageImgData,
              "PNG",
              0,
              0,
              pdfWidth,
              Math.min(pageImgHeightInMm, pdfHeight)
            );
          }
        }
      } else {
        // Single page
        const imgX = (pdfWidth - finalWidth) / 2;
        pdf.addImage(imgData, "PNG", imgX, 0, finalWidth, finalHeight);
      }

      pdf.save(`Invoice-${invoice.invoiceNo || "Draft"}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error generating PDF. Please try again.");
    }
  };

  return (
    <div className="min-h-screen pb-12 print:pb-0">
      {/* Action Toolbar */}
      <div className="no-print bg-white border-b sticky top-0 z-50 px-4 py-3 flex flex-wrap gap-4 items-center justify-center shadow-sm">
        <button
          onClick={handleNewInvoice}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          <FilePlus size={18} /> New Invoice
        </button>
        <button
          onClick={handleSaveDraft}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition"
        >
          <Save size={18} /> Save Draft
        </button>
        <button
          onClick={handleLoadDraft}
          className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition"
        >
          <Download size={18} /> Load Draft
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-black transition"
        >
          <Printer size={18} /> Print
        </button>
        <button
          onClick={handleExportPDF}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
        >
          <FileDown size={18} /> Export PDF
        </button>
      </div>

      {/* Invoice Document Canvas - A4 Size */}
      <div
        ref={invoiceRef}
        className="w-[210mm] min-h-[297mm] mx-auto bg-white shadow-2xl mt-8 mb-8 print:m-0 print:shadow-none print:w-[210mm] print:min-h-[297mm] print:max-w-none flex flex-col"
      >
        {/* Top Gold Band */}
        <div
          className="gold-band h-8 w-full"
          style={{ backgroundColor: GOLD_COLOR }}
        ></div>

        {/* Header Content */}
        <div className="px-8 py-4 flex justify-between items-start">
          <div className="flex-1">
            <div className="w-36 h-36 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center relative group">
              <img
                src={invoice.logo}
                alt="Logo"
                className="max-w-full max-h-full object-contain"
              />
            </div>
            {/* Logo shown only on print if exists */}
          </div>

          <div className="text-right">
            <h1 className="text-xl font-bold text-gray-800">
              ZEUS TECHNOLOGIES (PVT) LTD.
            </h1>
            <p className="text-sm text-gray-600 leading-relaxed">
              No. 15/B, Nelammahara Temple Road,
            </p>
            <p className="text-sm text-gray-600">Katuwawala, Boralesgamuwa</p>
          </div>
        </div>

        <div className="text-center mb-4">
          <h2 className="text-4xl font-light tracking-widest text-gray-800">
            INVOICE
          </h2>
        </div>

        {/* Invoice Info */}
        <div className="px-8 grid grid-cols-2 gap-6 mb-6">
          <div>
            <label className="text-sm font-semibold text-gray-500 uppercase block mb-1">
              Invoice to:
            </label>
            <input
              type="text"
              placeholder="Customer Name"
              className="w-full text-lg font-bold border-none focus:ring-0 p-0 mb-1"
              value={invoice.customerName}
              onChange={(e) =>
                setInvoice({ ...invoice, customerName: e.target.value })
              }
            />
            <textarea
              placeholder="Customer Address"
              className="w-full text-sm text-gray-600 border-none focus:ring-0 p-0 resize-none h-16"
              value={invoice.customerAddress}
              onChange={(e) =>
                setInvoice({ ...invoice, customerAddress: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex gap-4">
              <span className="text-sm font-semibold text-gray-500">
                Invoice No:
              </span>
              <span className="text-sm font-bold w-32 text-right">
                {invoice.invoiceNo}
              </span>
            </div>
            <div className="flex gap-4 items-center">
              <span className="text-sm font-semibold text-gray-500">Date:</span>
              <input
                type="date"
                className="text-sm font-bold text-right border-none focus:ring-0 p-0 w-32 h-7 bg-transparent"
                value={invoice.date}
                onChange={(e) =>
                  setInvoice({ ...invoice, date: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="px-8 flex-grow">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-white">
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-bold uppercase w-1/2">
                  ITEM/JOB
                </th>
                <th className="border border-gray-300 px-3 py-2 text-center text-sm font-bold uppercase">
                  Quantity
                </th>
                <th className="border border-gray-300 px-3 py-2 text-center text-sm font-bold uppercase">
                  Unit
                </th>
                <th className="border border-gray-300 px-3 py-2 text-center text-sm font-bold uppercase">
                  Rate (LKR)
                </th>
                <th className="border border-gray-300 px-3 py-2 text-right text-sm font-bold uppercase">
                  Total (LKR)
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id} className="group relative">
                  <td className="border border-gray-300 px-3 py-1.5">
                    <textarea
                      className="w-full border-none focus:ring-0 p-0 text-sm resize-none overflow-hidden"
                      value={item.description}
                      onChange={(e) =>
                        updateItem(item.id, "description", e.target.value)
                      }
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = "auto";
                        target.style.height = target.scrollHeight + "px";
                      }}
                      placeholder="Enter job description..."
                    />
                    <button
                      onClick={() => removeItem(item.id)}
                      className="no-print absolute -left-10 top-1/2 -translate-y-1/2 text-red-500 opacity-0 group-hover:opacity-100 transition p-2"
                      title="Remove Row"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5">
                    <input
                      type="number"
                      step="any"
                      className="w-full border-none focus:ring-0 p-0   h-10"
                      value={item.quantity || ""}
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          "quantity",
                          parseFloat(e.target.value)
                        )
                      }
                    />
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5">
                    <input
                      type="text"
                      className="w-full border-none focus:ring-0 p-0   h-10"
                      value={item.unit}
                      placeholder="e.g. kW"
                      onChange={(e) =>
                        updateItem(item.id, "unit", e.target.value)
                      }
                    />
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5">
                    <input
                      type="number"
                      step="0.01"
                      className="w-full border-none focus:ring-0 p-0   h-10"
                      value={item.rate || ""}
                      onChange={(e) =>
                        updateItem(item.id, "rate", parseFloat(e.target.value))
                      }
                    />
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5 text-right text-sm font-medium">
                    {formatCurrency(item.total)}
                  </td>
                </tr>
              ))}
              {/* Empty rows to maintain layout consistency if few items (max 4 total rows) */}

              {/* Grand Total Row */}
              <tr>
                <td colSpan={4} className="border-none px-3 py-2 text-right">
                  <span className="text-sm font-bold uppercase bg-gray-100 px-8 py-2 border border-gray-300 mr-[-1rem]">
                    Total
                  </span>
                </td>
                <td className="border border-gray-300 px-3 py-2 text-right text-sm font-bold">
                  {formatCurrency(grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>

          <button
            onClick={addItem}
            disabled={invoice.items.length >= 4}
            className="no-print mt-4 flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} /> Add New Row{" "}
            {invoice.items.length >= 4 ? "(Max 4 rows)" : ""}
          </button>
        </div>

        {/* Footer Section: Payment & Signature */}
        <div className="px-8 py-6 grid grid-cols-2 gap-24">
          <div>
            <h3 className="text-sm font-bold uppercase mb-4 tracking-wider">
              PAYMENT METHOD
            </h3>
            <div className="space-y-2">
              <div className="flex gap-1 text-sm text-gray-600">
                <span>Branch:Katubedda</span>
              </div>
              <div className="flex gap-1 text-sm text-gray-600 whitespace-nowrap">
                <span>Account Name: ZEUS TECHNOLOGIES PVT LTD</span>
              </div>
              <div className="flex gap-1 text-sm text-gray-600">
                <span>Account No:8023608760</span>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-lg font-medium text-gray-800 italic">
                Thank you for your business!
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-end ml-16">
            {invoice.signature && (
              <img
                src={invoice.signature}
                alt="Signature"
                className="h-16 w-auto object-contain mb-1 print:block"
              />
            )}
            <div className="w-64 border-t border-gray-400 mt-2 pt-2 text-center">
              <span className="text-sm font-semibold text-gray-700">
                Authorized Signature
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Contact Bar */}
        <div
          className="mt-auto gold-band min-h-10 py-2 w-full flex items-center justify-between px-8 text-white text-xs font-medium"
          style={{ backgroundColor: GOLD_COLOR }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
            </svg>
            <h6>071-747-7721</h6>
            {/* <input
              className="bg-transparent border-none focus:ring-0 p-0 text-white placeholder-white/70 flex-1 min-w-0"
              value={invoice.phone}
              onChange={(e) =>
                setInvoice({ ...invoice, phone: e.target.value })
              }
            /> */}
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
            </svg>
            <h6>sales@zeustechnologies.com</h6>
          </div>
        </div>
      </div>
    </div>
  );
}
