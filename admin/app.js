import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import { get, getDatabase, ref, push, set, remove, update, child } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-database.js";
import { getFirestore, collection, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

import { firebaseConfig } from './../firebaseConfig.js';

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const firestore = getFirestore(app);

// Evento para envio dos PDFs
document.getElementById("enviar-pdf-btn").addEventListener("click", async function () {
    const input = document.getElementById("enviar-arquivo-pdf-input");
    const files = input.files;

    if (files.length === 0) {
        Toastify({
            text: "Selecione pelo menos um arquivo PDF!",
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

    for (const file of files) {
        const base64Pdf = await convertFileToBase64(file);
        await savePdfToFirebase(file.name, base64Pdf);
    }

    Toastify({
        text: "Arquivos enviados com sucesso!",
        duration: 3000,
        newWindow: true,
        close: true,
        gravity: "bottom", // `top` or `bottom`
        position: "right", // `left`, `center` or `right`
        stopOnFocus: true, // Prevents dismissing of toast on hover
        style: {
            background: 'green',
        },
        onClick: function(){} // Callback after click
    }).showToast();
    document.getElementById("enviar-arquivo-pdf-input").value = ''
    carregarUploadsExistentes()
});

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
    const pdfRef = push(ref(database, "pdfs/")); // Cria um novo registro no nó "pdfs"
    await set(pdfRef, {
        nomeArquivo: nomeArquivo,
        base64Pdf: base64Pdf,
        uuid:  push(ref(database, "pdfs/")).key
    });
}

function carregarUploadsExistentes(){
    const pdfRef = ref(database, `pdfs/`)

    get(pdfRef).then((snapshot)=>{
        const data = snapshot.val()
        document.getElementById('lista-arquivos-area').innerHTML = ''
        if(data){
            Object.values(data).forEach((doc)=>{
                document.getElementById('lista-arquivos-area').innerHTML += `
                            <ul id="doc-arquivo-ul-${doc.uuid}">
                <li class="nome-arquivo-li">${doc.nomeArquivo}</li>
                <li><div class="baixar-pdf-btn" id="baixar-pdf-btn" style="display: none"></div></li>
                <li><div class="deletar-pdf-btn" id="deletar-pdf-btn" data-doc-uuid="${doc.uuid}"></div></li>
            </ul><br>
                
                `
            })
        }
    })
}

carregarUploadsExistentes()

document.getElementById('lista-arquivos-area').addEventListener('click', (e)=>{
    const docUuid = e.target.dataset.docUuid

    if(docUuid){
        const pdfRef = ref(database, `pdfs/${docUuid}`)
        remove(pdfRef).then(()=>{
            carregarUploadsExistentes()
        })
    }
})