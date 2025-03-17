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
    document.getElementById('geral-loading').style.display = 'block'
    let cpf = document.getElementById("cpfInput").value.trim();
    cpf = formatCPF(cpf);  // Suponho que a função formatCPF formate o CPF corretamente

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
        document.getElementById('geral-loading').style.display = 'none'
        return;
    }

    // Acesso ao Realtime Database no Firebase
    const informeRendimentosRef = ref(database, `informeRendimentos/`);
    get(informeRendimentosRef).then((snapshot) => {
        
        const data = snapshot.val();
        const informes = [];

        if (data) {
            Object.keys(data).forEach((key) => {
                const informe = data[key];
                if (informe.CPF === cpf) {
                    // Adiciona os informes com o CPF correspondente à lista
                    informes.push(informe);
                }
            });

            if (informes.length > 0) {
                // Se houver informes com o CPF correspondente, vamos gerar os PDFs
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF('p', 'mm', 'a4'); // Criando um documento PDF em formato A4

                informes.forEach((informe, index) => {
                    // Criar um objeto Image para calcular as proporções da imagem
                    const img = new Image();
                    img.onload = function () {
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

                        // Se não for o último informe, adicionar uma nova página no PDF
                        if (index < informes.length - 1) {
                            doc.addPage(); // Nova página para o próximo informe
                        } else {
                            // Quando terminar, salvar o PDF
                            doc.save(`${cpf}_informe.pdf`);
                            document.getElementById('geral-loading').style.display = 'none'
                        }
                    };

                    // Definir a imagem do base64 para o objeto Image
                    img.src = informe.base64Comprimido;
                });
            } else {
                Toastify({
                    text: "Nenhum informe encontrado para este CPF.",
                    duration: 3000,
                    newWindow: true,
                    close: true,
                    gravity: "bottom",
                    position: "right",
                    stopOnFocus: true,
                    style: { background: 'orange' },
                }).showToast();
                document.getElementById('geral-loading').style.display = 'none'
            }
        }
    }).catch((error) => {
        Toastify({
            text: "Erro ao buscar os dados.",
            duration: 3000,
            newWindow: true,
            close: true,
            gravity: "bottom",
            position: "right",
            stopOnFocus: true,
            style: { background: 'red' },
        }).showToast();
        console.error(error);
    });
});



