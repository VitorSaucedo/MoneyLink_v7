/**
 * admin_notifications.js - Sistema de notificações para funcionalidades de administração do TI
 * 
 * Gerencia exibição de notificações específicas das páginas de administração
 */

// Função para mostrar notificações específicas de admin
function showAdminNotification(type, message) {
  // Remover notificações existentes
  $('.notification-admin-ajax').remove();
  
  const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
  const iconClass = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle';
  
  const notification = $(`
    <div class="alert ${alertClass} alert-dismissible fade show notification-admin-ajax" 
         style="position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 300px;">
      <i class="fas ${iconClass} me-2"></i>
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `);
  
  $('body').append(notification);
  
  // Auto remover após 5 segundos
  setTimeout(() => {
    notification.fadeOut(300, function() {
      $(this).remove();
    });
  }, 5000);
}

// Função para mostrar notificações de validação em formulários de admin
function showAdminValidationNotification(fieldId, message, type = 'error') {
  const $field = $('#' + fieldId);
  if (!$field.length) return;
  
  // Remover notificações anteriores do campo
  $field.next('.admin-validation-feedback').remove();
  $field.removeClass('is-invalid is-valid');
  
  if (type === 'error') {
    $field.addClass('is-invalid');
    const feedback = $(`<div class="invalid-feedback admin-validation-feedback">${message}</div>`);
    $field.after(feedback);
  } else if (type === 'success') {
    $field.addClass('is-valid');
    const feedback = $(`<div class="valid-feedback admin-validation-feedback">${message}</div>`);
    $field.after(feedback);
  }
}

// Função para limpar notificações de validação
function clearAdminValidationNotification(fieldId) {
  const $field = $('#' + fieldId);
  $field.next('.admin-validation-feedback').remove();
  $field.removeClass('is-invalid is-valid');
}

// Função melhorada de fallback para notificações (movida e melhorada do admin.js)
function showAdminNotificationFallback(type, message) {
  // Remover notificações existentes
  $('.notification-ajax, .notification-admin-ajax').remove();
  
  const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
  const iconClass = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle';
  
  const notification = $(`
    <div class="alert ${alertClass} alert-dismissible fade show notification-admin-ajax" 
         style="position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 300px;">
      <i class="fas ${iconClass} me-2"></i>
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `);
  
  $('body').append(notification);
  
  // Auto remover após 5 segundos
  setTimeout(() => {
    notification.fadeOut(300, function() {
      $(this).remove();
    });
  }, 5000);
}

// Função para mostrar notificação de validação de ramal
function showRamalValidationNotification(type, message, ramalInput) {
  const $ramalInput = $(ramalInput);
  const $feedback = $ramalInput.siblings('.admin-validation-feedback');
  
  // Remover feedback anterior
  $feedback.remove();
  $ramalInput.removeClass('is-invalid is-valid');
  
  if (type === 'error') {
    $ramalInput.addClass('is-invalid');
    const feedback = $(`<div class="invalid-feedback admin-validation-feedback">${message}</div>`);
    $ramalInput.after(feedback);
  } else if (type === 'success') {
    $ramalInput.addClass('is-valid');
  }
}

// Exportar funções para uso global
window.TIAdminNotifications = {
  showAdminNotification: showAdminNotification,
  showAdminValidationNotification: showAdminValidationNotification,
  clearAdminValidationNotification: clearAdminValidationNotification,
  showAdminNotificationFallback: showAdminNotificationFallback,
  showRamalValidationNotification: showRamalValidationNotification
}; 