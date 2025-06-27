from django import forms
from django.utils import timezone
from .models import (
    TipoPeriferico, 
    Periferico, 
    PosicaoAtendimento, 
    AtribuicaoFuncionarioPA, 
    AtribuicaoPerifericoPA,
    Sala,
    Ilha,
    Computador,
    AtribuicaoComputadorPA,
    Monitor,
    AtribuicaoMonitorPA,
    Loja,
    Chip,
    Email,
    Storm,
    Sistema,
    CoordenadorSala
)
from apps.funcionarios.models import Funcionario
from .utils import atribuir_item_pa, verificar_disponibilidade_periferico, verificar_disponibilidade_computador


class LojaForm(forms.ModelForm):
    class Meta:
        model = Loja
        fields = ['nome', 'empresa', 'status']
        widgets = {
            'nome': forms.TextInput(attrs={'class': 'form-control'}),
            'empresa': forms.Select(attrs={'class': 'form-select'}),
            'status': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }

class TipoPerifericoForm(forms.ModelForm):
    class Meta:
        model = TipoPeriferico
        fields = ['nome', 'descricao']
        widgets = {
            'nome': forms.TextInput(attrs={'class': 'form-control'}),
            'descricao': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
        }

class PerifericoForm(forms.ModelForm):
    class Meta:
        model = Periferico
        fields = ['tipo', 'marca', 'modelo', 'numero_serie', 'condicao', 'estado', 'status', 'data_aquisicao', 'quantidade', 'loja', 'observacoes']
        widgets = {
            'tipo': forms.Select(attrs={'class': 'form-control'}),
            'marca': forms.TextInput(attrs={'class': 'form-control'}),
            'modelo': forms.TextInput(attrs={'class': 'form-control'}),
            'numero_serie': forms.TextInput(attrs={'class': 'form-control'}),
            'condicao': forms.Select(attrs={'class': 'form-control'}),
            'estado': forms.Select(attrs={'class': 'form-control'}),
            'status': forms.Select(attrs={'class': 'form-control'}),
            'data_aquisicao': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'quantidade': forms.NumberInput(attrs={'class': 'form-control', 'min': 0}),
            'loja': forms.Select(attrs={'class': 'form-control'}),
            'observacoes': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
        }

    def save(self, commit=True):
        instance = super().save(commit=False)
        if instance.quantidade > 0:
            instance.status = 'disponivel'
        else:
            instance.status = 'inativo'
        
        if commit:
            instance.save()
        return instance

class SalaForm(forms.ModelForm):
    class Meta:
        model = Sala
        fields = ['nome', 'titulo', 'loja', 'setor', 'descricao']
        widgets = {
            'nome': forms.TextInput(attrs={'class': 'form-control'}),
            'titulo': forms.TextInput(attrs={'class': 'form-control'}),
            'loja': forms.Select(attrs={'class': 'form-select'}),
            'setor': forms.Select(attrs={'class': 'form-select'}),
            'descricao': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
        }

class IlhaForm(forms.ModelForm):
    class Meta:
        model = Ilha
        fields = ['nome', 'titulo', 'sala', 'quantidade_pas', 'descricao']
        widgets = {
            'nome': forms.TextInput(attrs={'class': 'form-control'}),
            'titulo': forms.TextInput(attrs={'class': 'form-control'}),
            'sala': forms.Select(attrs={'class': 'form-select'}),
            'quantidade_pas': forms.NumberInput(attrs={'class': 'form-control', 'min': 1}),
            'descricao': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Se já tem uma instância com sala definida, filtrar por loja da sala
        if self.instance and self.instance.pk and self.instance.sala and self.instance.sala.loja:
            self.fields['sala'].queryset = Sala.objects.filter(loja=self.instance.sala.loja)

class PosicaoAtendimentoForm(forms.ModelForm):
    quantidade_pas = forms.IntegerField(
        initial=1,
        min_value=1,
        max_value=12,
        widget=forms.NumberInput(attrs={'class': 'form-control', 'min': 1, 'max': 12})
    )
    
    class Meta:
        model = PosicaoAtendimento
        fields = ['numero', 'titulo', 'sala', 'ilha', 'status', 'observacoes']
        widgets = {
            'numero': forms.TextInput(attrs={'class': 'form-control'}),
            'titulo': forms.TextInput(attrs={'class': 'form-control'}),
            'sala': forms.Select(attrs={'class': 'form-select'}),
            'ilha': forms.Select(attrs={'class': 'form-select'}),
            'status': forms.Select(attrs={'class': 'form-select'}),
            'observacoes': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
        }
        
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['numero'].required = False
        if 'ilha' in self.data:
            try:
                ilha_id = int(self.data.get('ilha'))
                self.fields['numero'].help_text = "Deixe em branco para numeração automática baseada na ilha."
            except (ValueError, TypeError):
                pass
                
    def clean(self):
        cleaned_data = super().clean()
        sala = cleaned_data.get('sala')
        ilha = cleaned_data.get('ilha')
        
        # Verificar se a ilha pertence à sala selecionada
        if sala and ilha and ilha.sala != sala:
            self.add_error('ilha', 'A ilha selecionada não pertence à sala escolhida.')
            
        return cleaned_data

class AtribuicaoFuncionarioPAForm(forms.ModelForm):
    class Meta:
        model = AtribuicaoFuncionarioPA
        fields = ['funcionario', 'posicao_atendimento', 'data_inicio', 'data_fim', 'ativo']
        widgets = {
            'funcionario': forms.Select(attrs={'class': 'form-control'}),
            'posicao_atendimento': forms.Select(attrs={'class': 'form-control'}),
            'data_inicio': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'data_fim': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'ativo': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }

class AtribuicaoPerifericoPAForm(forms.ModelForm):
    class Meta:
        model = AtribuicaoPerifericoPA
        fields = ['periferico', 'posicao_atendimento', 'data_atribuicao']
        widgets = {
            'periferico': forms.Select(attrs={'class': 'form-control'}),
            'posicao_atendimento': forms.Select(attrs={'class': 'form-control'}),
            'data_atribuicao': forms.DateTimeInput(attrs={'class': 'form-control', 'type': 'datetime-local'}),
        }
        
    def clean(self):
        cleaned_data = super().clean()
        periferico = cleaned_data.get('periferico')
        posicao_atendimento = cleaned_data.get('posicao_atendimento')
        
        if periferico and posicao_atendimento:
            # Verificar disponibilidade do periférico
            disponivel, mensagem = verificar_disponibilidade_periferico(
                periferico.id, 
                pa_id=self.instance.posicao_atendimento.id if self.instance.pk else None
            )
            
            if not disponivel:
                self.add_error('periferico', mensagem)
        
        return cleaned_data
        
    def save(self, commit=True):
        instance = super().save(commit=False)
        
        # Se estamos atualizando, retornamos a instância normalmente
        if self.instance.pk:
            if commit:
                instance.save()
            return instance
        
        # Se estamos criando, usamos nossa função auxiliar
        if commit:
            # Usar a função auxiliar para atribuir o periférico à PA
            atribuicao, _ = atribuir_item_pa(
                item=self.cleaned_data['periferico'],
                pa=self.cleaned_data['posicao_atendimento'],
                model_atribuicao=AtribuicaoPerifericoPA,
                data_atribuicao=self.cleaned_data.get('data_atribuicao') or timezone.now()
            )
            return atribuicao
        else:
            # Definir valores básicos para retornar a instância não salva
            instance.data_atribuicao = self.cleaned_data.get('data_atribuicao') or timezone.now()
            instance.ativo = True
            return instance

class ComputadorForm(forms.ModelForm):
    class Meta:
        model = Computador
        fields = ['marca', 'condicao', 'status', 'quantidade', 'loja', 'observacoes']
        widgets = {
            'marca': forms.TextInput(attrs={'class': 'form-control'}),
            'condicao': forms.Select(attrs={'class': 'form-control'}),
            'status': forms.Select(attrs={'class': 'form-control'}),
            'quantidade': forms.NumberInput(attrs={'class': 'form-control', 'min': 1}),
            'loja': forms.Select(attrs={'class': 'form-control'}),
            'observacoes': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
        }

class AtribuicaoComputadorPAForm(forms.ModelForm):
    class Meta:
        model = AtribuicaoComputadorPA
        fields = ['computador', 'posicao_atendimento']
        widgets = {
            'computador': forms.Select(attrs={'class': 'form-control'}),
            'posicao_atendimento': forms.Select(attrs={'class': 'form-control'}),
        }
        
    def clean(self):
        cleaned_data = super().clean()
        computador = cleaned_data.get('computador')
        posicao_atendimento = cleaned_data.get('posicao_atendimento')
        
        if computador and posicao_atendimento:
            # Verificar disponibilidade do computador
            disponivel, mensagem = verificar_disponibilidade_computador(
                computador.id, 
                pa_id=self.instance.posicao_atendimento.id if self.instance.pk else None
            )
            
            if not disponivel:
                self.add_error('computador', mensagem)
        
        return cleaned_data
        
    def save(self, commit=True):
        instance = super().save(commit=False)
        
        # Se estamos atualizando, retornamos a instância normalmente
        if self.instance.pk:
            if commit:
                instance.save()
            return instance
        
        # Se estamos criando, usamos nossa função auxiliar
        if commit:
            # Usar a função auxiliar para atribuir o computador à PA
            atribuicao, _ = atribuir_item_pa(
                item=self.cleaned_data['computador'],
                pa=self.cleaned_data['posicao_atendimento'],
                model_atribuicao=AtribuicaoComputadorPA
            )
            return atribuicao
        else:
            # Definir valores básicos para retornar a instância não salva
            instance.data_atribuicao = timezone.now()
            instance.ativo = True
            return instance

class MonitorForm(forms.ModelForm):
    class Meta:
        model = Monitor
        fields = ['marca', 'tamanho', 'condicao', 'status', 'loja', 'observacoes']
        widgets = {
            'marca': forms.TextInput(attrs={'class': 'form-control'}),
            'tamanho': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ex: 24", 27"'}),
            'condicao': forms.Select(attrs={'class': 'form-control'}),
            'status': forms.Select(attrs={'class': 'form-control'}),
            'loja': forms.Select(attrs={'class': 'form-control'}),
            'observacoes': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
        }

class AtribuicaoMonitorPAForm(forms.ModelForm):
    class Meta:
        model = AtribuicaoMonitorPA
        fields = ['monitor', 'posicao_atendimento']
        widgets = {
            'monitor': forms.Select(attrs={'class': 'form-control'}),
            'posicao_atendimento': forms.Select(attrs={'class': 'form-control'}),
        }
        
    def clean(self):
        cleaned_data = super().clean()
        monitor = cleaned_data.get('monitor')
        posicao_atendimento = cleaned_data.get('posicao_atendimento')
        
        if monitor and posicao_atendimento:
            # Verificar se o monitor já está atribuído a outra PA
            atribuicao_existente = AtribuicaoMonitorPA.objects.filter(
                monitor=monitor,
                ativo=True
            ).exclude(
                posicao_atendimento=posicao_atendimento
            ).first()
            
            if atribuicao_existente:
                self.add_error('monitor', f'Monitor já está atribuído à PA {atribuicao_existente.posicao_atendimento.numero}')
        
        return cleaned_data
        
    def save(self, commit=True):
        instance = super().save(commit=False)
        
        # Se estamos atualizando, retornamos a instância normalmente
        if self.instance.pk:
            if commit:
                instance.save()
            return instance
        
        # Se estamos criando, usamos nossa função auxiliar
        if commit:
            # Verificar se já existe atribuição ativa para este monitor
            monitor = self.cleaned_data['monitor']
            atribuicao_existente = AtribuicaoMonitorPA.objects.filter(
                monitor=monitor,
                ativo=True
            ).first()
            
            if atribuicao_existente:
                # Desativar atribuição existente
                atribuicao_existente.ativo = False
                atribuicao_existente.data_remocao = timezone.now()
                atribuicao_existente.save()
            
            # Criar nova atribuição
            instance.ativo = True
            instance.save()
            
            # Atualizar status do monitor
            monitor.status = 'em_uso'
            monitor.save()
            
            return instance
        else:
            # Definir valores básicos para retornar a instância não salva
            instance.ativo = True
            return instance

class ChipForm(forms.ModelForm):
    class Meta:
        model = Chip
        fields = ['numero', 'funcionario', 'setor', 'status', 'data_entrega', 'data_banimento']
        widgets = {
            'numero': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Número do chip'}),
            'funcionario': forms.Select(attrs={'class': 'form-select'}),
            'setor': forms.Select(attrs={'class': 'form-select'}),
            'status': forms.Select(attrs={'class': 'form-select'}),
            'data_entrega': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'data_banimento': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
        }
        labels = {
            'numero': 'Número do Chip',
            'funcionario': 'Funcionário',
            'setor': 'Setor (Funcionário)',
            'status': 'Status',
            'data_entrega': 'Data de Entrega',
            'data_banimento': 'Data de Banimento',
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Filtrar funcionários ativos
        self.fields['funcionario'].queryset = Funcionario.objects.filter(status=True).order_by('nome_completo')
        self.fields['setor'].queryset = Funcionario.objects.filter(status=True).order_by('nome_completo')

    def save(self, commit=True):
        email_obj = super().save(commit=False)
        
        # Se um funcionário foi selecionado, atribuir automaticamente ramal e setor
        if self.cleaned_data.get('funcionario'):
            funcionario = self.cleaned_data['funcionario']
            email_obj.setor = funcionario
        
        if commit:
            email_obj.save()
        return email_obj

class CoordenadorSalaForm(forms.ModelForm):
    class Meta:
        model = CoordenadorSala
        fields = ['funcionario', 'sala', 'tipo']
        widgets = {
            'funcionario': forms.Select(attrs={'class': 'form-select'}),
            'sala': forms.Select(attrs={'class': 'form-select'}),
            'tipo': forms.Select(attrs={'class': 'form-select'}),
        }
        labels = {
            'funcionario': 'Funcionário',
            'sala': 'Sala',
            'tipo': 'Tipo de Coordenação',
        }
    
    def __init__(self, *args, **kwargs):
        loja_id = kwargs.pop('loja_id', None)
        super().__init__(*args, **kwargs)
        
        # Filtrar funcionários ativos
        self.fields['funcionario'].queryset = Funcionario.objects.filter(status=True).order_by('nome_completo')
        
        # Filtrar salas por loja se fornecida
        if loja_id:
            self.fields['sala'].queryset = Sala.objects.filter(loja_id=loja_id).order_by('nome')
        else:
            self.fields['sala'].queryset = Sala.objects.all().order_by('nome')

class EmailForm(forms.ModelForm):
    class Meta:
        model = Email
        fields = ['funcionario', 'email', 'senha', 'tipo', 'status', 'email_recuperacao']
        widgets = {
            'funcionario': forms.Select(attrs={'class': 'form-select'}),
            'email': forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'email@exemplo.com'}),
            'senha': forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'Senha do e-mail'}),
            'tipo': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ex: Corporativo, Pessoal, etc.'}),
            'status': forms.Select(attrs={'class': 'form-select'}),
            'email_recuperacao': forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'email_recuperacao@exemplo.com'}),
        }
        labels = {
            'funcionario': 'Funcionário',
            'email': 'E-mail',
            'senha': 'Senha',
            'tipo': 'Tipo',
            'status': 'Status',
            'email_recuperacao': 'E-mail de Recuperação',
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Filtrar funcionários ativos
        self.fields['funcionario'].queryset = Funcionario.objects.filter(status=True).order_by('nome_completo')
        
        # Tornar campos opcionais conforme necessário
        self.fields['funcionario'].required = False
        self.fields['tipo'].required = False
        self.fields['email_recuperacao'].required = False
    
    def save(self, commit=True):
        email_obj = super().save(commit=False)
        
        # Se um funcionário foi selecionado, atribuir automaticamente ramal e setor
        if self.cleaned_data.get('funcionario'):
            funcionario = self.cleaned_data['funcionario']
            email_obj.setor = funcionario
        
        if commit:
            email_obj.save()
        return email_obj


class StormForm(forms.ModelForm):
    class Meta:
        model = Storm
        fields = ['funcionario', 'email_administrativo', 'situacao', 'usuario', 'senha']
        widgets = {
            'funcionario': forms.Select(attrs={'class': 'form-select'}),
            'email_administrativo': forms.EmailInput(attrs={'class': 'form-control'}),
            'situacao': forms.Select(attrs={'class': 'form-select'}),
            'usuario': forms.TextInput(attrs={'class': 'form-control', 'maxlength': '4', 'pattern': '[0-9]{1,4}'}),
            'senha': forms.PasswordInput(attrs={'class': 'form-control'}),
        }
        labels = {
            'funcionario': 'Funcionário',
            'email_administrativo': 'E-mail Administrativo',
            'situacao': 'Situação',
            'usuario': 'Usuário',
            'senha': 'Senha',
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Filtrar funcionários ativos
        self.fields['funcionario'].queryset = Funcionario.objects.filter(status=True).order_by('nome_completo')


class SistemaForm(forms.ModelForm):
    class Meta:
        model = Sistema
        fields = ['funcionario', 'acesso', 'senha']
        widgets = {
            'funcionario': forms.Select(attrs={'class': 'form-select'}),
            'acesso': forms.TextInput(attrs={'class': 'form-control'}),
            'senha': forms.PasswordInput(attrs={'class': 'form-control'}),
        }
        labels = {
            'funcionario': 'Funcionário',
            'acesso': 'Acesso',
            'senha': 'Senha',
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Filtrar funcionários ativos
        self.fields['funcionario'].queryset = Funcionario.objects.filter(status=True).order_by('nome_completo')