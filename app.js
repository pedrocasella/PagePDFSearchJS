import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-database.js";
import { firebaseConfig } from "./firebaseConfig.js";

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

function formatCPF(cpf) {
    cpf = cpf.replace(/\D/g, ""); 
    if (cpf.length !== 11) return ""; 
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"); 
}

document.getElementById("buscar-pdf-btn").addEventListener("click", async function () {
    let cpf = document.getElementById("cpfInput").value.trim();
    cpf = formatCPF(cpf);

    if (!cpf) {
        Toastify({
            text: "Digite um CPF válido para buscar!",
            duration: 3000,
            newWindow: true,
            close: true,
            gravity: "bottom",
            position: "right",
            stopOnFocus: true,
            style: { background: 'red' },
        }).showToast();
        return;
    }

    document.getElementById("pdfContainer").innerHTML = "";

    let foundPdf = false;

    // 🔹 Busca PDFs no Firebase
    const pdfsRef = ref(database, "pdfs/");
    const snapshot = await get(pdfsRef);

    if (snapshot.exists()) {
        const pdfs = snapshot.val();
        for (const key in pdfs) {
            const { base64Pdf } = pdfs[key];
            const pdfData = atob(base64Pdf.split(",")[1]); 
            const typedarray = new Uint8Array(pdfData.length);
            for (let i = 0; i < pdfData.length; i++) {
                typedarray[i] = pdfData.charCodeAt(i);
            }

            const found = await findCpfPages(typedarray, cpf);
            if (found) foundPdf = true;
        }
    }

    // 🔹 Busca o PDF localmente
    const foundLocalPdf = await loadLocalPdf(cpf);
    if (foundLocalPdf) foundPdf = true;

    if (!foundPdf) {
        Toastify({
            text: "Nenhum documento encontrado!",
            duration: 3000,
            newWindow: true,
            close: true,
            gravity: "bottom",
            position: "right",
            stopOnFocus: true,
            style: { background: 'red' },
        }).showToast();
    }
});

// 🔹 Função para carregar e verificar o PDF local
async function loadLocalPdf(cpf) {
    try {
        const response = await fetch("./docs/INFORME DE RENDIMENTOS 2025 (1).pdf");
        if (!response.ok) throw new Error("Falha ao carregar o PDF local");

        const pdfData = await response.arrayBuffer();
        return await findCpfPages(pdfData, cpf);
    } catch (error) {
        console.error("Erro ao carregar PDF local:", error);
        return false;
    }
}

// 🔹 Configura o pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

// 🔹 Função para buscar CPF dentro das páginas do PDF
async function findCpfPages(pdfData, cpf) {
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    let found = false;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2 }); // Aumenta a qualidade
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };

        await page.render(renderContext).promise; // Renderiza a página no canvas

        // Converte a página para imagem Base64
        const imageBase64 = canvas.toDataURL("image/png");

        // Aplica OCR para extrair texto da imagem
        const text = await extractTextFromImage(imageBase64);

        console.log("Texto extraído da página " + pageNum + ": ", text); // Debug

        if (text.includes(cpf)) {
            found = true;
            await renderPage(page);
        }
    }

    return found;
}

// 🔹 Função para extrair texto de imagem com OCR (Definição corrigida)
async function extractTextFromImage(imageBase64) {
    const { data: { text } } = await Tesseract.recognize(
        imageBase64,
        "por", // Define o idioma para português
        {
            logger: m => console.log(m) // Mostra o progresso no console
        }
    );
    return text;
}

// 🔹 Função para renderizar páginas no HTML
async function renderPage(page) {
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;
    document.getElementById("pdfContainer").appendChild(canvas);
}

document.getElementById('baixar-arquivo-btn').addEventListener('click', () => {
    window.print();
});
