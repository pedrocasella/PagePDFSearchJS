import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import { get, getDatabase, ref, push, set, remove } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-database.js";
import { firebaseConfig } from "./../firebaseConfig.js";

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Configurar o caminho do worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// Função para comprimir imagem em base64
function compressImage(base64Image) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const maxWidth = 1024;
            const maxHeight = 1024;
            let width = img.width;
            let height = img.height;

            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = width * ratio;
                height = height * ratio;
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            // Aqui ajustamos a qualidade para 50%
            const compressedBase64 = canvas.toDataURL("image/png", 0.5); // Comprimir com 50% da qualidade
            resolve(compressedBase64);
        };
        img.src = base64Image;
    });
}

// Evento para envio dos PDFs
document.getElementById("enviar-pdf-btn").addEventListener("click", async function () {
    console.log("📂 Iniciando processamento do PDF...");
    
    const input = document.getElementById("enviar-arquivo-pdf-input");
    if (!input.files.length) {
        Toastify({
            text: "Selecione um arquivo PDF.",
            duration: 3000,
            newWindow: true,
            close: true,
            gravity: "bottom",
            position: "right",
            stopOnFocus: true,
            style: { background: 'red' },
        }).showToast();
        console.warn("⚠️ Nenhum arquivo selecionado.");
        return;
    }

    const pdfFile = input.files[0];
    console.log(`📄 Arquivo selecionado: ${pdfFile.name} (${(pdfFile.size / 1024 / 1024).toFixed(2)} MB)`);

    const reader = new FileReader();

    reader.onload = async function (event) {
        console.log("📥 Lendo arquivo PDF...");
        
        const typedarray = new Uint8Array(event.target.result);
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;

        console.log(`📑 PDF carregado com ${pdf.numPages} páginas.`);

        let results = [];
        
        const totalPages = pdf.numPages;
        const progressBar = document.getElementById("progress-bar");

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            console.log(`🖼️ Processando página ${pageNum}...`);

            const page = await pdf.getPage(pageNum);
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            const scaleFactor = 3;
            const viewport = page.getViewport({ scale: scaleFactor });
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({ canvasContext: context, viewport }).promise;
            console.log(`📌 Página ${pageNum} renderizada com alta resolução.`);

            // Imagem inteira em base64
            const fullImgDataUrl = canvas.toDataURL("image/png");

            // Calculando 20% abaixo do topo e 50% acima do fim da imagem
            const cropHeight = canvas.height * 0.20;
            const cropBottom = canvas.height * 0.50;
            const croppedImageData = context.getImageData(0, cropHeight, canvas.width, canvas.height - cropBottom - cropHeight);

            const croppedCanvas = document.createElement("canvas");
            const croppedContext = croppedCanvas.getContext("2d");
            croppedCanvas.width = canvas.width;
            croppedCanvas.height = canvas.height - cropHeight - cropBottom;
            croppedContext.putImageData(croppedImageData, 0, 0);

            const croppedImgDataUrl = croppedCanvas.toDataURL("image/png");

            // Executando OCR na imagem recortada
            const { data: { text } } = await Tesseract.recognize(
                croppedImgDataUrl, 
                "por", 
                {
                    psm: 11, 
                    preserve_interword_spaces: 1,
                    tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,-()&%$#!@:_",
                }
            );

            console.log(`✅ Texto extraído da página ${pageNum}: ${text.substring(0, 150)}...`);

            const cpfRegex = /\d{3}\.\d{3}\.\d{3}-\d{2}/;
            const cpf = (text.match(cpfRegex) || [])[0];
            let nome = "";
            if (cpf) {
                const nomeStart = text.indexOf(cpf) + cpf.length;
                nome = text.slice(nomeStart).trim().split("\n")[0];
            }

            const pageData = {
                base64Comprimido: fullImgDataUrl, 
                Nome: nome || "Não encontrado", 
                CPF: cpf || "Não encontrado",
            }

            const informeRendimentosRef = ref(database, `informeRendimentos/`);
            const pushInforme = push(informeRendimentosRef);
            set(pushInforme, pageData).then(() => {
                console.log('Salvo com sucesso!');
            });

            results.push(pageData);

            // Atualizando o progresso
            const progress = (pageNum / totalPages) * 100;
            progressBar.value = progress;
        }

        console.log("✅ Processamento concluído!");
        console.log("📜 Resultados:", results);
        Toastify({
            text: "Processamento concluído!",
            duration: 3000,
            newWindow: true,
            close: true,
            gravity: "bottom",
            position: "right",
            stopOnFocus: true,
            style: { background: 'green' },
        }).showToast();
        carregarInformesLidos()
    };

    reader.readAsArrayBuffer(pdfFile);
});

function carregarInformesLidos(){

    const informeRendimentosRef = ref(database, `informeRendimentos/`);
    get(informeRendimentosRef).then((snapshot)=>{
        const data = snapshot.val()
        document.getElementById('lista-informes-area').innerHTML = ''
        if(data){
            Object.keys(data).forEach((key)=>{
                if(data[key].Nome != 'Não encontrado' && data[key].CPF != 'Não encontrado'){
                    document.getElementById('lista-informes-area').innerHTML += `
                    <ul>
            <li><p class="nome">${data[key].Nome}</p><p class="cpf">${data[key].CPF}</p></li>
            <li><div class="baixar-informe-btn" id="baixar-informe-btn" data-informe-uuid="${key}"></div></li>
            <li><div class="deletar-informe-btn" id="deletar-informe-btn" data-informe-uuid="${key}"></div></li>
        </ul><br>
            `
                }

            })

        }
    })
}

carregarInformesLidos()

    //Deletar Informes
    document.getElementById('lista-informes-area').addEventListener('click', (e)=>{
        const id = e.target.id
        const informeUuid = e.target.dataset.informeUuid

    // Função para baixar o PDF com a imagem
    if (id === 'baixar-informe-btn' && informeUuid) {
        const informeRendimentosRef = ref(database, `informeRendimentos/${informeUuid}`);
        get(informeRendimentosRef).then((snapshot) => {
            const informe = snapshot.val();
            if (informe && informe.base64Comprimido) {
                const base64Image = informe.base64Comprimido;

                // Usando jsPDF para criar um PDF
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF('p', 'mm', 'a4');  // Página A4

                // Criar um objeto Image para calcular as proporções da imagem
                const img = new Image();
                img.onload = function() {
                    // Obter as dimensões da imagem
                    const imgWidth = img.width;
                    const imgHeight = img.height;

                    // Dimensões da página A4
                    const maxWidth = 210;  // Largura máxima da página A4 (210mm)
                    const maxHeight = 297; // Altura máxima da página A4 (297mm)

                    // Calcular a proporção para ajustar a imagem de modo que cubra toda a página
                    const widthRatio = maxWidth / imgWidth;
                    const heightRatio = maxHeight / imgHeight;

                    // Usar a maior proporção para garantir que a imagem cubra a página
                    const ratio = Math.max(widthRatio, heightRatio);

                    // Calcular o tamanho final da imagem
                    const finalWidth = imgWidth * ratio;
                    const finalHeight = imgHeight * ratio;

                    // Adicionar a imagem ao PDF, posicionando-a para que cubra a página
                    doc.addImage(img, 'JPEG', 0, 0, finalWidth, finalHeight);

                    // Gerar e baixar o PDF
                    doc.save(`${informe.Nome.replace(/\s/g, '_')}_${informe.CPF}.pdf`);
                };

                // Definir a imagem do base64
                img.src = base64Image;

                Toastify({
                    text: "Informe em PDF baixado com sucesso!",
                    duration: 3000,
                    newWindow: true,
                    close: true,
                    gravity: "bottom",
                    position: "right",
                    stopOnFocus: true,
                    style: { background: 'green' },
                }).showToast();
            }
        });
    }

        if(id == 'deletar-informe-btn' && informeUuid){
            const informeRendimentosRef = ref(database, `informeRendimentos/${informeUuid}`);
            remove(informeRendimentosRef).then(()=>{
                Toastify({
                    text: "Informe removido com sucesso!",
                    duration: 3000,
                    newWindow: true,
                    close: true,
                    gravity: "bottom",
                    position: "right",
                    stopOnFocus: true,
                    style: { background: 'green' },
                }).showToast();
                carregarInformesLidos()
            })
        }
    })

