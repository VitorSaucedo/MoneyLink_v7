# 🔧 **Guia de Implementação - Correções TI**

## 📋 **Resumo dos Problemas Identificados e Soluções**

### ✅ **1. URLs Corrigidas**
- ✅ Todas as URLs foram padronizadas (underscores → hyphens)
- ✅ Correspondência 100% entre JavaScript e Django URLs
- ✅ 19 arquivos JavaScript verificados

### 🚨 **2. Problemas Críticos que Precisam ser Implementados**

## 🔧 **Implementação dos Helpers JavaScript**

### **Passo 1: Adicionar Headers nos Templates**

Adicione os scripts helper em **todos os templates do módulo TI** antes dos scripts específicos:

```html
{% block addjs_extra %}
<!-- Helpers para CSRF e tratamento de erros (ADICIONAR PRIMEIRO) -->
<script src="{% static 'ti/js/ti_error_handler.js' %}"></script>
<script src="{% static 'debug_csrf_helper.js' %}"></script>

<!-- Scripts específicos existentes -->
<script src="{% static 'ti/js/admin_utils.js' %}"></script>
<script src="{% static 'ti/js/admin.js' %}"></script>
<!-- ... outros scripts ... -->
{% endblock %}
```

### **Passo 2: Atualizar Templates que Usam APIs**

**Templates que precisam ser atualizados:**
- `apps/ti/templates/ti/admin.html`
- `apps/ti/templates/ti/controle_salas.html`
- `apps/ti/templates/ti/controle_estoque.html`
- `apps/ti/templates/ti/controle_emails.html`
- `apps/ti/templates/ti/controle_chips.html`
- `apps/ti/templates/ti/controle_acessos.html`

### **Passo 3: Verificar Views que Podem Ter Problemas**

Execute este comando para testar as views:

```bash
python manage.py shell
```

```python
# No shell do Django
from django.test import Client
from django.contrib.auth.models import User

client = Client()
# Criar usuário temporário se necessário
user = User.objects.first()
client.force_login(user)

# Testar APIs principais
response = client.get('/ti/api/funcionarios/')
print(f"Status: {response.status_code}")
if response.status_code != 200:
    print(f"Erro: {response.content}")
```

## 🐛 **Problemas Específicos por Módulo**

### **Controle de Salas**
**Sintomas:** PAs não carregam, funcionários não aparecem
**Possível causa:** 
- API `/ti/api/controle-salas-data/` pode estar com erro
- JavaScript não está tratando resposta corretamente

**Solução:**
1. Abrir Dev Tools (F12) na página
2. Verificar erros no Console
3. Verificar requisições na aba Network

### **Controle de Estoque**
**Sintomas:** Tabelas não carregam dados
**Possível causa:**
- API `/ti/api/controle-estoque-data/` pode estar retornando formato incorreto

### **Formulários de Cadastro**
**Sintomas:** Formulários não salvam via AJAX
**Possível causa:**
- CSRF token não está sendo enviado
- URLs de POST podem estar incorretas

## 🔍 **Debug dos Problemas**

### **1. Verificar Console do Navegador**
```javascript
// Abrir Dev Tools (F12) e executar:
console.log('APIs disponíveis:', window.TIApiRequest);
console.log('Error handler:', window.TIErrorHandler);

// Testar uma API manualmente:
window.TIApiRequest.get('/ti/api/funcionarios/')
    .then(response => console.log('✅ Sucesso:', response))
    .catch(error => console.error('❌ Erro:', error));
```

### **2. Verificar Requisições AJAX**
1. Abrir Dev Tools (F12)
2. Ir na aba **Network**
3. Filtrar por **XHR/Fetch**
4. Recarregar a página
5. Verificar quais requisições estão falhando

### **3. Verificar CSRF Token**
```javascript
// No console do navegador:
console.log('CSRF Token:', $('[name=csrfmiddlewaretoken]').val());
```

## 📝 **Checklist de Implementação**

### **Antes de Testar:**
- [ ] Arquivos `ti_error_handler.js` e `debug_csrf_helper.js` criados
- [ ] Scripts adicionados aos templates
- [ ] Servidor Django funcionando
- [ ] Browser cache limpo (Ctrl+F5)

### **Durante o Teste:**
- [ ] Console do navegador aberto (F12)
- [ ] Aba Network aberta para monitorar requisições
- [ ] Testar carregamento de cada página TI
- [ ] Testar formulários de cadastro
- [ ] Verificar se mensagens de erro aparecem corretamente

### **Possíveis Erros e Soluções:**

| Erro | Causa Provável | Solução |
|------|----------------|---------|
| 403 Forbidden | CSRF token ausente | Verificar se helper está carregado |
| 404 Not Found | URL incorreta | Verificar mapeamento no urls.py |
| 500 Internal | Erro no backend | Verificar logs do Django |
| JavaScript Error | Script não carregado | Verificar ordem dos scripts |

## 🎯 **Próximos Passos Recomendados**

1. **Implementar os helpers** (scripts criados)
2. **Testar página por página** do módulo TI
3. **Verificar console** para erros JavaScript
4. **Monitorar aba Network** para requisições falhando
5. **Documentar erros específicos** que ainda persistirem

## 🆘 **Se os Problemas Persistirem**

Colete estas informações para análise mais detalhada:

1. **Console do navegador** (erros JavaScript)
2. **Aba Network** (requisições falhando)
3. **Logs do Django** (`python manage.py runserver`)
4. **Página específica** que não está funcionando
5. **Ação específica** que falha (ex: carregar dados, salvar formulário)

---

**💡 Lembre-se:** A maioria dos problemas de carregamento de dados após refatoração são causados por:
1. URLs incorretas (já corrigidas)
2. CSRF token ausente (helper criado)
3. Tratamento inadequado de erros (helper criado)
4. Formato de resposta da API inconsistente 