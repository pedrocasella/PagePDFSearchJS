import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import { get, getDatabase, ref, push, set, remove } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-database.js";
import { PDFDocument } from "https://cdn.jsdelivr.net/npm/pdf-lib/dist/pdf-lib.min.js";

import { firebaseConfig } from "./../firebaseConfig.js";

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Evento para envio dos PDFs
document.getElementById("enviar-pdf-btn").addEventListener("click", async function () {
    const input = document.getElementById("enviar-arquivo-pdf-input");
    const files = input.files;

    if (files.length === 0) {
        Toastify({
            text: "Selecione pelo menos um arquivo PDF!",
            duration: 3000,
            gravity: "bottom",
            position: "right",
            style: { background: "red" },
        }).showToast();
        return;
    }

    for (const file of files) {
        try {
            // Reduzir o PDF se necessário
            const compactedFile = await reduzirQualidadePDF(file, 5); // Reduz até 5MB
            const base64Pdf = await convertFileToBase64(compactedFile); // Converte para Base64

            // Salvar no Firebase
            await savePdfToFirebase(file.name, base64Pdf);
        } catch (error) {
            Toastify({
                text: error.message, // Mensagem de erro
                duration: 3000,
                gravity: "bottom",
                position: "right",
                style: { background: "red" },
            }).showToast();
            continue; // Pular para o próximo arquivo
        }
    }

    Toastify({
        text: "Arquivos enviados com sucesso!",
        duration: 3000,
        gravity: "bottom",
        position: "right",
        style: { background: "green" },
    }).showToast();

    document.getElementById("enviar-arquivo-pdf-input").value = "";
    carregarUploadsExistentes();
});

// Função para reduzir qualidade do PDF
async function reduzirQualidadePDF(file, maxSizeMB) {
    let arrayBuffer = await file.arrayBuffer();
    let pdfDoc = await PDFDocument.load(arrayBuffer);

    let pdfBytes = await pdfDoc.save();
    let pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });

    // Repetir o processo até que o tamanho do arquivo seja menor que o limite
    while (pdfBlob.size > maxSizeMB * 1024 * 1024) {
        const scaleFactor = 0.9; // Fator de redução (reduz a cada iteração)
        const pages = pdfDoc.getPages();

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const { width, height } = page.getSize();
            page.setSize(width * scaleFactor, height * scaleFactor); // Reduz tamanho da página
        }

        pdfBytes = await pdfDoc.save();
        pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
    }

    return pdfBlob;
}

// Função para converter arquivo em Base64
function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
}

// Função para salvar no Firebase Realtime Database
async function savePdfToFirebase(nomeArquivo, base64Pdf) {
    const pdfRef = push(ref(database, "pdfs/"));
    await set(pdfRef, {
        nomeArquivo: nomeArquivo,
        base64Pdf: base64Pdf,
        uuid: pdfRef.key,
    });
}

// Função para carregar uploads existentes
function carregarUploadsExistentes() {
    const pdfRef = ref(database, `pdfs/`);

    get(pdfRef).then((snapshot) => {
        const data = snapshot.val();
        document.getElementById("lista-arquivos-area").innerHTML = "";
        if (data) {
            Object.values(data).forEach((doc) => {
                document.getElementById("lista-arquivos-area").innerHTML += `
                    <ul id="doc-arquivo-ul-${doc.uuid}">
                        <li class="nome-arquivo-li">${doc.nomeArquivo}</li>
                        <li><div class="baixar-pdf-btn" id="baixar-pdf-btn" style="display: none"></div></li>
                        <li><div class="deletar-pdf-btn" id="deletar-pdf-btn" data-doc-uuid="${doc.uuid}"></div></li>
                    </ul><br>
                `;
            });
        }
    });
}

carregarUploadsExistentes();

// Evento para deletar arquivos
document.getElementById("lista-arquivos-area").addEventListener("click", (e) => {
    const docUuid = e.target.dataset.docUuid;

    if (docUuid) {
        const pdfRef = ref(database, `pdfs/${docUuid}`);
        remove(pdfRef).then(() => {
            carregarUploadsExistentes();
        });
    }
});
