// Versão mínima para teste
console.log('CONSULTA CLIENTE: JavaScript carregado!');

$(document).ready(function() {
    console.log('CONSULTA CLIENTE: Document ready executado!');
    
    // Função simples para testar modal
    window.abrirModalDadosNegociacao = function(agendamentoId) {
        console.log('TESTE Modal:', agendamentoId);
        alert('Modal funcionando! ID: ' + agendamentoId);
    };
    
    // Event listener básico
    $('#btn-adicionar-negociacao').on('click', function() {
        console.log('Botão clicado!');
        window.abrirModalDadosNegociacao(123);
    });
    
    console.log('CONSULTA CLIENTE: Configuração concluída!');
}); 