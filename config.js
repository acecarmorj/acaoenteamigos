/*
  CONFIGURAÇÕES FÁCEIS DE EDITAR
  Troque aqui os dados principais da rifa sem mexer no restante do sistema.
*/
window.RIFA_CONFIG = {
  NOME_RIFA: "Rifa Solidária — Ajude Davi e Vitória",
  TITULO_CURTO: "Rifa Solidária",
  SUBTITULO: "Ajude Davi e Vitória",

  RESPONSAVEL_NOME: "Juliana",
  WHATSAPP_RESPONSAVEL: "", // Exemplo: "5522999999999". Se deixar vazio, o WhatsApp abre para escolher contato.

  DATA_SORTEIO: "A definir",
  PREMIO_RIFA: "A definir",

  PIX_KEY: "229922848326",
  PIX_RECEBEDOR: "JULIANA",
  PIX_CIDADE: "CARMO",

  VALOR_NUMERO: 10,
  QUANTIDADE_NUMEROS: 100,

  ADMIN_PIN: "1234",

  // Segurança: false = comprovante vai para o painel e a responsável confirma após conferir no banco.
  // true = qualquer comprovante enviado pelo app já marca os números como pagos automaticamente.
  // Use true somente se a responsável aceitar esse risco.
  AUTO_CONFIRMAR_COM_COMPROVANTE: false,

  API_URL: "https://script.google.com/macros/s/AKfycbxPV_Y1h0k_ZbJl5XsF2fx3v8vx-r-s9mOk5SiaCAtKu3D9Ix5F-smWYPvVfv2g0OoN/exec"
};
