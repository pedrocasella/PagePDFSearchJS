import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-database.js";
import { firebaseConfig } from "./firebaseConfig.js";

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

function formatCPF(cpf) {
    cpf = cpf.replace(/\D/g, ""); // Remove tudo que não for número
    if (cpf.length !== 11) return ""; // Retorna vazio se não tiver 11 dígitos
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"); // Aplica a máscara
}

// Evento para buscar PDFs ao clicar no botão
document.getElementById("buscar-pdf-btn").addEventListener("click", async function () {
    let cpf = document.getElementById("cpfInput").value.trim();
    cpf = formatCPF(cpf);

    if (!cpf) {
        Toastify({
            text: "Digite um CPF válido para buscar!",
            duration: 3000,
            newWindow: true,
            close: true,
            gravity: "bottom", // `top` or `bottom`
            position: "right", // `left`, `center` or `right`
            stopOnFocus: true, // Prevents dismissing of toast on hover
            style: {
                background: 'red',
            },
            onClick: function(){} // Callback after click
        }).showToast();
        return;
    }

    if (!cpf) {
        Toastify({
            text: "Digite um CPF para buscar!",
            duration: 3000,
            newWindow: true,
            close: true,
            gravity: "bottom", // `top` or `bottom`
            position: "right", // `left`, `center` or `right`
            stopOnFocus: true, // Prevents dismissing of toast on hover
            style: {
                background: 'red',
            },
            onClick: function(){} // Callback after click
        }).showToast();
        return;
    }

    document.getElementById("pdfContainer").innerHTML = ""; // Limpa os PDFs anteriores

    const pdfsRef = ref(database, "pdfs/");
    const snapshot = await get(pdfsRef);

    if (snapshot.exists()) {
        const pdfs = snapshot.val();
        let foundPdf = false;

        for (const key in pdfs) {
            const { nomeArquivo, base64Pdf } = pdfs[key];
            const pdfData = atob(base64Pdf.split(",")[1]); // Decodifica Base64 para binário
            document.getElementById('search-area').style.display = 'none'
            document.getElementById('baixar-arquivo-btn').style.display = 'block'
            const typedarray = new Uint8Array(pdfData.length);
            for (let i = 0; i < pdfData.length; i++) {
                typedarray[i] = pdfData.charCodeAt(i);
            }

            const found = await findCpfPages(typedarray, cpf);
            if (found) {
                foundPdf = true;
            }
        }

        if (!foundPdf) {
            Toastify({
                text: "Nenhum documento encontrado!",
                duration: 3000,
                newWindow: true,
                close: true,
                gravity: "bottom", // `top` or `bottom`
                position: "right", // `left`, `center` or `right`
                stopOnFocus: true, // Prevents dismissing of toast on hover
                style: {
                    background: 'red',
                },
                onClick: function(){} // Callback after click
            }).showToast();
        }
    } else {
        Toastify({
            text: "Nenhum documento encontrado!",
            duration: 3000,
            newWindow: true,
            close: true,
            gravity: "bottom", // `top` or `bottom`
            position: "right", // `left`, `center` or `right`
            stopOnFocus: true, // Prevents dismissing of toast on hover
            style: {
                background: 'red',
            },
            onClick: function(){} // Callback after click
        }).showToast();
        
    }
});

// Define o caminho do worker para evitar erro
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

// Função para buscar CPF dentro das páginas do PDF
async function findCpfPages(pdfData, cpf) {
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    let found = false;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const text = textContent.items.map(item => item.str).join(" ");

        if (text.includes(cpf)) {
            found = true;
            await renderPage(page);
        }
    }

    return found;
}

// Função para renderizar páginas no HTML
async function renderPage(page) {
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };
    await page.render(renderContext).promise;

    document.getElementById("pdfContainer").appendChild(canvas);
}

document.getElementById('baixar-arquivo-btn').addEventListener('click', (e)=>{
    window.print()
})