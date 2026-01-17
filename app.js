
// Constants
const GOLD_COLOR = '#c09c3c';
const STORAGE_SEQ_KEY = 'zeus_invoice_sequence';
const STORAGE_DRAFT_KEY = 'zeus_invoice_draft';

// State
let invoiceItems = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initDefaultData();
    generateInvoiceNumber();
    addRow(); // Start with one row
    setupEventListeners();
});

function initDefaultData() {
    document.getElementById('invoice-date').valueAsDate = new Date();
    document.getElementById('bank-name').value = 'Commercial Bank';
    document.getElementById('bank-branch').value = 'Katubedda';
    document.getElementById('acc-name').value = 'ZEUS TECHNOLOGIES (PVT) LTD';
    document.getElementById('acc-no').value = '8023608760';
    document.getElementById('company-phone').value = '071-747-7721';
    document.getElementById('company-email').value = 'sales@zeustechnologies.com';
}

function generateInvoiceNumber() {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    
    let sequenceData = JSON.parse(localStorage.getItem(STORAGE_SEQ_KEY) || '{}');
    let seq = 1;

    if (sequenceData.date === dateStr) {
        seq = sequenceData.lastSeq + 1;
    }

    const invoiceNo = `SS${dateStr}-${seq.toString().padStart(3, '0')}`;
    document.getElementById('invoice-no').textContent = invoiceNo;
    
    localStorage.setItem(STORAGE_SEQ_KEY, JSON.stringify({ date: dateStr, lastSeq: seq }));
    return invoiceNo;
}

function setupEventListeners() {
    // Add row
    document.getElementById('btn-add-row').addEventListener('click', addRow);

    // Save/Load/PDF
    document.getElementById('btn-save').addEventListener('click', saveDraft);
    document.getElementById('btn-load').addEventListener('click', loadDraft);
    document.getElementById('btn-export-pdf').addEventListener('click', exportPDF);
    document.getElementById('btn-new').addEventListener('click', () => {
        if(confirm('Clear all and start new invoice?')) location.reload();
    });

    // Image Uploads
    handleFileUpload('logo-upload', 'logo-img', 'logo-placeholder', 'logo-print');
    handleFileUpload('sig-upload', 'sig-img', 'sig-placeholder', 'sig-print');

    // Auto-calculate on any input change in the table
    document.getElementById('table-body').addEventListener('input', (e) => {
        if (e.target.classList.contains('calc-trigger')) {
            calculateGrandTotal();
        }
        // Auto-resize textareas
        if (e.target.tagName === 'TEXTAREA') {
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
        }
    });
}

async function exportPDF() {
    const element = document.getElementById('invoice-page');
    const invoiceNo = document.getElementById('invoice-no').textContent;
    
    const opt = {
        margin: 0,
        filename: `${invoiceNo}.pdf`,
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: { 
            scale: 3, 
            useCORS: true, 
            letterRendering: true,
            logging: false
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Show loading state
    const btn = document.getElementById('btn-export-pdf');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Generating...';

    try {
        if (window.showSaveFilePicker) {
            // Modern "Save As" approach
            const handle = await window.showSaveFilePicker({
                suggestedName: `${invoiceNo}.pdf`,
                types: [{
                    description: 'PDF Document',
                    accept: { 'application/pdf': ['.pdf'] },
                }],
            });
            
            const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
            const writable = await handle.createWritable();
            await writable.write(pdfBlob);
            await writable.close();
        } else {
            // Standard fallback download
            await html2pdf().set(opt).from(element).save();
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('PDF Export Error:', err);
            alert('Failed to export PDF. Please try the standard Print option.');
        }
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

function addRow(data = null) {
    const tbody = document.getElementById('table-body');
    const tr = document.createElement('tr');
    tr.className = 'group relative';
    
    tr.innerHTML = `
        <td class="border border-gray-300 px-4 py-2 relative">
            <button class="no-print row-action-btn opacity-0 group-hover:opacity-100 transition" onclick="this.closest('tr').remove(); calculateGrandTotal();">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
            </button>
            <textarea placeholder="Description of work..." class="w-full border-none focus:ring-0 p-0 text-sm outline-none bg-transparent">${data?.description || ''}</textarea>
        </td>
        <td class="border border-gray-300 px-4 py-2">
            <input type="number" step="any" value="${data?.qty || ''}" class="calc-trigger qty-input w-full border-none focus:ring-0 p-0 text-center text-sm outline-none bg-transparent">
        </td>
        <td class="border border-gray-300 px-4 py-2">
            <input type="text" value="${data?.unit || ''}" class="w-full border-none focus:ring-0 p-0 text-center text-sm outline-none bg-transparent">
        </td>
        <td class="border border-gray-300 px-4 py-2">
            <input type="number" step="0.01" value="${data?.rate || ''}" class="calc-trigger rate-input w-full border-none focus:ring-0 p-0 text-center text-sm outline-none bg-transparent">
        </td>
        <td class="border border-gray-300 px-4 py-2 text-right text-sm font-medium line-total">
            ${data?.total ? formatCurrency(data.total) : '0.00'}
        </td>
    `;
    
    tbody.appendChild(tr);
    calculateGrandTotal();
}

function calculateGrandTotal() {
    const rows = document.querySelectorAll('#table-body tr');
    let grandTotal = 0;

    rows.forEach(row => {
        const qty = parseFloat(row.querySelector('.qty-input').value) || 0;
        const rate = parseFloat(row.querySelector('.rate-input').value) || 0;
        const total = qty * rate;
        
        row.querySelector('.line-total').textContent = formatCurrency(total);
        grandTotal += total;
    });

    document.getElementById('grand-total').textContent = formatCurrency(grandTotal);
}

function formatCurrency(num) {
    return new Intl.NumberFormat('en-LK', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
}

function handleFileUpload(inputId, imgId, placeholderId, printImgId) {
    const input = document.getElementById(inputId);
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result;
                document.getElementById(imgId).src = base64;
                document.getElementById(imgId).classList.remove('hidden');
                document.getElementById(printImgId).src = base64;
                document.getElementById(printImgId).classList.remove('hidden');
                document.getElementById(placeholderId).classList.add('hidden');
            };
            reader.readAsDataURL(file);
        }
    });
}

function saveDraft() {
    const rows = [];
    document.querySelectorAll('#table-body tr').forEach(row => {
        rows.push({
            description: row.querySelector('textarea').value,
            qty: row.querySelector('.qty-input').value,
            unit: row.querySelectorAll('input')[1].value,
            rate: row.querySelector('.rate-input').value
        });
    });

    const data = {
        invoiceNo: document.getElementById('invoice-no').textContent,
        date: document.getElementById('invoice-date').value,
        customer: {
            name: document.getElementById('cust-name').value,
            address: document.getElementById('cust-address').value
        },
        items: rows,
        bank: {
            name: document.getElementById('bank-name').value,
            branch: document.getElementById('bank-branch').value,
            accName: document.getElementById('acc-name').value,
            accNo: document.getElementById('acc-no').value
        }
    };

    localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(data));
    alert('Draft Saved Successfully!');
}

function loadDraft() {
    const data = JSON.parse(localStorage.getItem(STORAGE_DRAFT_KEY));
    if (!data) return alert('No draft found!');

    document.getElementById('invoice-no').textContent = data.invoiceNo;
    document.getElementById('invoice-date').value = data.date;
    document.getElementById('cust-name').value = data.customer.name;
    document.getElementById('cust-address').value = data.customer.address;
    document.getElementById('bank-name').value = data.bank.name;
    document.getElementById('bank-branch').value = data.bank.branch;
    document.getElementById('acc-name').value = data.bank.accName;
    document.getElementById('acc-no').value = data.bank.accNo;

    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';
    data.items.forEach(item => addRow(item));
}
