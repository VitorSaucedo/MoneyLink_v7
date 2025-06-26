/**
 * posicao_atendimento_form.js - Funcionalidades para o formulário de posição de atendimento
 * 
 * Este arquivo contém as funções para atualizar as opções de ilhas quando a sala mudar.
 */

document.addEventListener('DOMContentLoaded', function() {
  // Obter os elementos do formulário
  var salaSelect = document.getElementById('id_sala');
  var ilhaSelect = document.getElementById('id_ilha');
  
  if (salaSelect && ilhaSelect) {
    salaSelect.addEventListener('change', function() {
      // Reset ilha select
      ilhaSelect.innerHTML = '<option value="">---------</option>';
      
      if (salaSelect.value) {
        // Fazer uma requisição AJAX para obter as ilhas da sala selecionada
        fetch('/ti/api/ilhas-por-sala/' + salaSelect.value + '/')
          .then(response => response.json())
          .then(data => {
            data.forEach(ilha => {
              var option = document.createElement('option');
              option.value = ilha.id;
              option.textContent = ilha.nome;
              ilhaSelect.appendChild(option);
            });
          });
      }
    });
  }
}); 