from django.db import models
from django.core.exceptions import ValidationError
from apps.funcionarios.models import Funcionario, Loja, Setor  # Importação específica em vez de "*"
from django.utils import timezone

# Create your models here.
# Nota: A classe Loja agora é importada de apps.funcionarios.models

class TipoPeriferico(models.Model):
    nome = models.CharField(max_length=100)
    descricao = models.TextField(blank=True, null=True)
    
    def __str__(self):
        return self.nome
    
    class Meta:
        verbose_name = 'Tipo'
        verbose_name_plural = 'Periféricos - Tipos'

class Periferico(models.Model):
    tipo = models.ForeignKey(TipoPeriferico, on_delete=models.CASCADE)
    marca = models.CharField(max_length=100)
    modelo = models.CharField(max_length=100)
    numero_serie = models.CharField(max_length=100, blank=True, null=True)
    data_aquisicao = models.DateField(blank=True, null=True)
    quantidade = models.PositiveIntegerField(default=1)
    loja = models.ForeignKey(Loja, on_delete=models.CASCADE, related_name='perifericos')
    status_choices = [
        ('disponivel', 'Disponível'),
        ('em_uso', 'Em Uso'),
        ('manutencao', 'Em Manutenção'),
        ('inativo', 'Inativo')
    ]
    status = models.CharField(max_length=20, choices=status_choices, default='disponivel', verbose_name="Status")
    
    # Campos do fluxograma
    condicao_choices = [
        ('novo', 'Novo'),
        ('antigo', 'Antigo')
    ]
    condicao = models.CharField(max_length=20, choices=condicao_choices, default='novo', verbose_name="Condição")
    
    estado_choices = [
        ('funcionando', 'Funcionando'),
        ('com_defeito', 'Com Defeito'),
        ('em_reparo', 'Em Reparo')
    ]
    estado = models.CharField(max_length=20, choices=estado_choices, default='funcionando', verbose_name="Estado")
    
    observacoes = models.TextField(blank=True, null=True, verbose_name="Observações")
    
    def __str__(self):
        return f"{self.tipo} - {self.marca} {self.modelo}"
    
    class Meta:
        verbose_name = 'Periférico'
        verbose_name_plural = 'Periféricos'

class Computador(models.Model):
    marca = models.CharField(max_length=100, verbose_name="Marca")
    quantidade = models.PositiveIntegerField(default=1)
    
    # Campos do fluxograma
    condicao_choices = [
        ('novo', 'Novo'),
        ('antigo', 'Antigo')
    ]
    condicao = models.CharField(max_length=20, choices=condicao_choices, default='novo', verbose_name="Condição")
    
    status_choices = [
        ('disponivel', 'Disponível'),
        ('em_uso', 'Em Uso'),
        ('manutencao', 'Em Manutenção'),
        ('inativo', 'Inativo')
    ]
    status = models.CharField(max_length=20, choices=status_choices, default='disponivel', verbose_name="Status")
    
    loja = models.ForeignKey(Loja, on_delete=models.CASCADE, null=True, blank=True, related_name='computadores')
    observacoes = models.TextField(blank=True, null=True, verbose_name="Observações")
    
    def __str__(self):
        return f"{self.marca}"
    
    class Meta:
        verbose_name = 'Computador'
        verbose_name_plural = 'Computadores'

class Monitor(models.Model):
    marca = models.CharField(max_length=100, blank=True, null=True, verbose_name="Marca")
    tamanho = models.CharField(max_length=20, blank=True, null=True, verbose_name="Tamanho")  # Ex: "24", "27"
    
    # Campos do fluxograma
    condicao_choices = [
        ('novo', 'Novo'),
        ('antigo', 'Antigo')
    ]
    condicao = models.CharField(max_length=20, choices=condicao_choices, default='novo', verbose_name="Condição")
    
    
    
    status_choices = [
        ('disponivel', 'Disponível'),
        ('em_uso', 'Em Uso'),
        ('manutencao', 'Em Manutenção'),
        ('inativo', 'Inativo')
    ]
    status = models.CharField(max_length=20, choices=status_choices, default='disponivel', verbose_name="Status")
    
    loja = models.ForeignKey(Loja, on_delete=models.CASCADE, related_name='monitores')
    observacoes = models.TextField(blank=True, null=True, verbose_name="Observações")

    
    def __str__(self):
        return f"{self.marca} " if self.marca else "Sem Marca"
    
    class Meta:
        verbose_name = 'Monitor'
        verbose_name_plural = 'Monitores'

class Sala(models.Model):
    nome = models.CharField(max_length=100, verbose_name="Nome")
    titulo = models.CharField(max_length=100, blank=True, null=True, verbose_name="Título")
    descricao = models.TextField(blank=True, null=True, verbose_name="Descrição")
    loja = models.ForeignKey(Loja, on_delete=models.CASCADE, related_name='salas', null=True)
    setor = models.ForeignKey(Setor, on_delete=models.CASCADE, related_name='salas_ti', null=True, blank=True, verbose_name="Setor")
    
    @property
    def status(self):
        return self.loja.status if self.loja else False
    
    def __str__(self):
        loja_nome = self.loja.nome if self.loja else "S/ Loja"
        return f"{self.nome} ({loja_nome})"
    
    class Meta:
        verbose_name = 'Sala'
        verbose_name_plural = 'Salas'

class Ilha(models.Model):
    nome = models.CharField(max_length=100, verbose_name="Nome")
    titulo = models.CharField(max_length=100, blank=True, null=True, verbose_name="Título")
    sala = models.ForeignKey(Sala, on_delete=models.CASCADE, related_name='ilhas')
    quantidade_pas = models.PositiveIntegerField(default=1, verbose_name="Quantidade de PAs")
    descricao = models.TextField(blank=True, null=True, verbose_name="Descrição")
    
    @property
    def loja(self):
        return self.sala.loja if self.sala else None
    
    @property
    def setor(self):
        return self.sala.setor if self.sala else None
    
    @property
    def status(self):
        return self.sala.loja.status if self.sala and self.sala.loja else False
    
    def __str__(self):
        sala_nome = self.sala.nome if self.sala else "S/ Sala"
        loja_nome = self.sala.loja.nome if self.sala and self.sala.loja else "S/ Loja"
        return f"{self.nome} - {sala_nome} ({loja_nome})"
    
    class Meta:
        verbose_name = 'Ilha'
        verbose_name_plural = 'Ilhas'

class PosicaoAtendimento(models.Model):
    numero = models.CharField(max_length=20, verbose_name="Número")
    titulo = models.CharField(max_length=100, blank=True, null=True, verbose_name="Título")
    ilha = models.ForeignKey(Ilha, on_delete=models.CASCADE, related_name='posicoes_atendimento', null=True, blank=True)
    sala = models.ForeignKey(Sala, on_delete=models.CASCADE, null=True, blank=True)
    status_choices = [
        ('livre', 'Livre'),
        ('ocupada', 'Ocupada'),
        ('manutencao', 'Em Manutenção'),
        ('inativa', 'Inativa')
    ]
    status = models.CharField(max_length=20, choices=status_choices, default='livre', verbose_name="Status")
    observacoes = models.TextField(blank=True, null=True, verbose_name="Observações")
    
    def save(self, *args, **kwargs):
        # Se não tiver número, atribui automaticamente baseado na ilha
        if not self.numero and self.ilha:
            pas_na_ilha = PosicaoAtendimento.objects.filter(ilha=self.ilha).count()
            self.numero = f"{pas_na_ilha + 1:02d}"
        
        # Adicionar lógica para garantir que sala da PA seja a mesma da ilha, se ilha estiver definida
        if self.ilha and self.sala != self.ilha.sala:
            self.sala = self.ilha.sala
        super().save(*args, **kwargs)
    
    @property
    def loja(self):
        if self.sala and self.sala.loja:
            return self.sala.loja
        elif self.ilha and self.ilha.sala and self.ilha.sala.loja:
            return self.ilha.sala.loja
        return None
    
    @property  
    def setor(self):
        if self.sala and self.sala.setor:
            return self.sala.setor
        elif self.ilha and self.ilha.sala and self.ilha.sala.setor:
            return self.ilha.sala.setor
        return None
    
    @property
    def funcionario_atual(self):
        """Retorna o funcionário atualmente atribuído a esta posição de atendimento, se existir"""
        atribuicao = self.atribuicaofuncionariopa_set.filter(ativo=True).order_by('-data_inicio').first()
        return atribuicao.funcionario if atribuicao else None
    
    def __str__(self):
        # Ajustar para caso ilha ou sala sejam None inicialmente
        ilha_nome = self.ilha.nome if self.ilha else "S/ Ilha"
        sala_nome = self.sala.nome if self.sala else "S/ Sala"
        return f"PA {self.numero} - {ilha_nome} ({sala_nome})"
    
    class Meta:
        verbose_name = 'PA'
        verbose_name_plural = 'PAs'
        ordering = ['ilha', 'numero']

class AtribuicaoFuncionarioPA(models.Model):
    funcionario = models.ForeignKey(Funcionario, on_delete=models.CASCADE)
    posicao_atendimento = models.ForeignKey(PosicaoAtendimento, on_delete=models.CASCADE)
    data_inicio = models.DateField()
    data_fim = models.DateField(blank=True, null=True)
    ativo = models.BooleanField(default=True)
    
    def save(self, *args, **kwargs):
        # Se a atribuição está sendo marcada como ativa e não tem data de início, define agora.
        if self.ativo and not self.data_inicio:
            self.data_inicio = timezone.now().date() # Para DateField
        
        # Se a atribuição está sendo inativada e não tem data de fim, define agora.
        if not self.ativo and self.data_fim is None:
            self.data_fim = timezone.now().date() # Para DateField
        
        # Se está reativando uma atribuição que tinha data_fim, limpar data_fim.
        if self.ativo and self.data_fim is not None:
            self.data_fim = None
            
        super().save(*args, **kwargs)
    
    def __str__(self):
        status = "Ativa" if self.ativo else f"Finalizada em {self.data_fim.strftime('%d/%m/%Y') if self.data_fim else '-'}"
        # Garante que self.funcionario e self.posicao_atendimento não causem erro se forem None (improvável com ForeignKey)
        func_str = str(self.funcionario) if self.funcionario else "Funcionário não definido"
        pa_str = str(self.posicao_atendimento) if self.posicao_atendimento else "PA não definida"
        return f"{func_str} - {pa_str} ({status})"
    
    class Meta:
        verbose_name = 'Atribuição de Funcionário'
        verbose_name_plural = 'PAs - Atribuições de Funcionários'

class AtribuicaoPerifericoPA(models.Model):
    periferico = models.ForeignKey(Periferico, on_delete=models.CASCADE)
    posicao_atendimento = models.ForeignKey(PosicaoAtendimento, on_delete=models.CASCADE)
    data_atribuicao = models.DateTimeField()
    data_remocao = models.DateTimeField(blank=True, null=True)
    ativo = models.BooleanField(default=True)
    
    def save(self, *args, **kwargs):
        # Se não tem data de atribuição, define para agora
        if not self.data_atribuicao:
            self.data_atribuicao = timezone.now()
        
        # Se está inativando e não tem data de remoção, define para agora
        if not self.ativo and self.data_remocao is None:
            self.data_remocao = timezone.now()
            
        # Se está reativando, limpa a data de remoção
        if self.ativo and self.data_remocao is not None:
            self.data_remocao = None
            
        super().save(*args, **kwargs)
    
    def __str__(self):
        status = "Ativo" if self.ativo else f"Removido em {self.data_remocao.strftime('%d/%m/%Y %H:%M') if self.data_remocao else '-'}"
        return f"{self.periferico} - {self.posicao_atendimento} ({status})"
    
    class Meta:
        verbose_name = 'Atribuição de Periférico'
        verbose_name_plural = 'Periféricos - Atribuições'

class AtribuicaoComputadorPA(models.Model):
    computador = models.ForeignKey(Computador, on_delete=models.CASCADE)
    posicao_atendimento = models.ForeignKey(PosicaoAtendimento, on_delete=models.CASCADE)
    data_atribuicao = models.DateTimeField(auto_now_add=True)
    data_remocao = models.DateTimeField(blank=True, null=True)
    ativo = models.BooleanField(default=True)
    
    def save(self, *args, **kwargs):
        # Se está inativando e não tem data de remoção, define para agora
        if not self.ativo and self.data_remocao is None:
            self.data_remocao = timezone.now()
            
        # Se está reativando, limpa a data de remoção
        if self.ativo and self.data_remocao is not None:
            self.data_remocao = None
            
        super().save(*args, **kwargs)
    
    def __str__(self):
        status = "Ativo" if self.ativo else f"Removido em {self.data_remocao.strftime('%d/%m/%Y %H:%M') if self.data_remocao else '-'}"
        return f"{self.computador} - {self.posicao_atendimento} ({status})"
    
    class Meta:
        verbose_name = 'Atribuição de Computador'
        verbose_name_plural = 'Computadores - Atribuições'

class AtribuicaoMonitorPA(models.Model):
    monitor = models.ForeignKey(Monitor, on_delete=models.CASCADE)
    posicao_atendimento = models.ForeignKey(PosicaoAtendimento, on_delete=models.CASCADE)
    data_atribuicao = models.DateTimeField(auto_now_add=True, verbose_name="Data de Atribuição")
    data_remocao = models.DateTimeField(blank=True, null=True, verbose_name="Data de Remoção")
    ativo = models.BooleanField(default=True, verbose_name="Ativo")
    
    def save(self, *args, **kwargs):
        # Se está inativando e não tem data de remoção, define para agora
        if not self.ativo and self.data_remocao is None:
            self.data_remocao = timezone.now()
            
        # Se está reativando, limpa a data de remoção
        if self.ativo and self.data_remocao is not None:
            self.data_remocao = None
            
        super().save(*args, **kwargs)
    
    def __str__(self):
        status = "Ativo" if self.ativo else f"Removido em {self.data_remocao.strftime('%d/%m/%Y %H:%M') if self.data_remocao else '-'}"
        return f"{self.monitor} - {self.posicao_atendimento} ({status})"
    
    class Meta:
        verbose_name = 'Atribuição de Monitor'
        verbose_name_plural = 'Monitores - Atribuições'

class Chip(models.Model):
    numero = models.CharField(max_length=50, unique=True, verbose_name="Número")
    funcionario = models.ForeignKey(Funcionario, on_delete=models.CASCADE, null=True, blank=True, related_name='chips_funcionario', verbose_name="Funcionário")
    
    @property
    def ramal(self):
        if self.funcionario and hasattr(self.funcionario, 'ramal_ti'):
            return self.funcionario.ramal_ti
        return None

    setor = models.ForeignKey(Funcionario, on_delete=models.SET_NULL, null=True, blank=True, related_name='chips_setor', verbose_name="Setor (Funcionário)")
    
    status_choices = [
        ('ativo', 'Ativo'),
        ('banido', 'Banido'),
        ('livre', 'Livre'),
        ('reutilizado', 'Reutilizado'),
        ('perdido', 'Perdido'),
        ('recarregar', 'Recarregar'),
        ('desativado', 'Desativado')
    ]
    status = models.CharField(max_length=20, choices=status_choices, default='livre', verbose_name="Status")
    
    data_entrega = models.DateField(blank=True, null=True, verbose_name="Data de Entrega")
    data_criacao_recarga = models.DateField(auto_now_add=True, verbose_name="Data de Criação/Recarga")
    data_banimento = models.DateField(blank=True, null=True, verbose_name="Data de Banimento")
    
    def __str__(self):
        return f"Chip {self.numero} - {self.get_status_display()}"
    
    class Meta:
        verbose_name = 'Chip'
        verbose_name_plural = 'Chips'
        ordering = ['numero']

class Email(models.Model):
    @property
    def ramal(self):
        if self.funcionario and hasattr(self.funcionario, 'ramal_ti'):
            return self.funcionario.ramal_ti
        return None
        
    funcionario = models.ForeignKey(Funcionario, on_delete=models.CASCADE, null=True, blank=True, related_name='emails_funcionario', verbose_name="Funcionário")
    email = models.EmailField(unique=True, verbose_name="Email")
    senha = models.CharField(max_length=255, verbose_name="Senha")
    setor = models.ForeignKey(Funcionario, on_delete=models.SET_NULL, null=True, blank=True, related_name='emails_setor', verbose_name="Setor (Funcionário)")
    
    status_choices = [
        ('ativo', 'Em uso'),
        ('inativo', 'sem uso'),
        ('funcionario_desligado', 'Func desligado'),
        ('sem_senha', 'Sem senha'),
        ('sem_recuperacao', 'Sem n° recup'),
        ('renovado', 'renovado')
    ]
    status = models.CharField(max_length=25, choices=status_choices, default='ativo', verbose_name="Status")
    
    tipo = models.CharField(max_length=100, blank=True, null=True, verbose_name="Tipo")
    email_recuperacao = models.EmailField(blank=True, null=True, verbose_name="Email de Recuperação")
    
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name="Data de Criação")
    data_atualizacao = models.DateTimeField(auto_now=True, verbose_name="Data de Atualização")
    
    def __str__(self):
        funcionario_nome = self.funcionario.nome_completo if self.funcionario else "S/ Funcionário"
        return f"{self.email} - {funcionario_nome} ({self.get_status_display()})"
    
    class Meta:
        verbose_name = 'Email'
        verbose_name_plural = 'Emails'
        ordering = ['email']

class Storm(models.Model):
    funcionario = models.ForeignKey(Funcionario, on_delete=models.CASCADE, related_name='storm_acessos', verbose_name="Funcionário")
    email_administrativo = models.EmailField(verbose_name="E-mail administrativo")
    
    situacao_choices = [
        ('ativo', 'Ativo'),
        ('desativado', 'Desativado')
    ]
    situacao = models.CharField(max_length=20, choices=situacao_choices, default='ativo', verbose_name="Situação")
    
    usuario = models.CharField(max_length=4, verbose_name="Usuário (max 4 números)", help_text="Máximo 4 números")
    senha = models.CharField(max_length=255, verbose_name="Senha")
    
    def clean(self):
        """Validação customizada para o campo usuario"""
        super().clean()
        if self.usuario:
            # Verificar se contém apenas números
            if not self.usuario.isdigit():
                raise ValidationError({'usuario': 'O campo usuário deve conter apenas números.'})
            
            # Verificar se tem no máximo 4 dígitos
            if len(self.usuario) > 4:
                raise ValidationError({'usuario': 'O campo usuário deve ter no máximo 4 dígitos.'})
    
    def save(self, *args, **kwargs):
        """Override do save para executar validação"""
        self.clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Storm - {self.funcionario.nome_completo} ({self.usuario})"
    
    @property
    def ramal(self):
        """Retorna o ramal do funcionário através da nova relação"""
        if self.funcionario and hasattr(self.funcionario, 'ramal_ti'):
            return self.funcionario.ramal_ti
        return None
    
    class Meta:
        verbose_name = 'Storm - Acesso'
        verbose_name_plural = 'Storm - Acessos'
        ordering = ['funcionario__nome_completo']
        unique_together = ('funcionario', 'usuario')  # Garante que um funcionário não tenha usuários duplicados

class Sistema(models.Model):
    funcionario = models.ForeignKey(Funcionario, on_delete=models.CASCADE, related_name='sistema_acessos', verbose_name="Funcionário")
    acesso = models.CharField(max_length=255, verbose_name="Acesso")
    senha = models.CharField(max_length=255, verbose_name="Senha")
    
    def __str__(self):
        return f"Sistema - {self.funcionario.nome_completo} ({self.acesso})"
    
    @property
    def cargo(self):
        """Retorna apenas o nome do cargo do funcionário sem a empresa"""
        if self.funcionario and self.funcionario.cargo:
            return self.funcionario.cargo.nome
        return None
    
    @property
    def departamento_setor(self):
        """Retorna o departamento/setor do funcionário"""
        if self.funcionario and self.funcionario.setor:
            return f"{self.funcionario.setor.departamento.nome}/{self.funcionario.setor.nome}"
        return None
    
    class Meta:
        verbose_name = 'Sistema - Acesso'
        verbose_name_plural = 'Sistema - Acessos'
        ordering = ['funcionario__nome_completo']
        unique_together = ('funcionario', 'acesso')  # Garante que um funcionário não tenha acessos duplicados

class CoordenadorSala(models.Model):
    funcionario = models.ForeignKey(Funcionario, on_delete=models.CASCADE, related_name='coordenacao_salas', verbose_name="Funcionário")
    sala = models.ForeignKey(Sala, on_delete=models.CASCADE, related_name='coordenadores', verbose_name="Sala")
    
    tipo_choices = [
        ('coordenador', 'Coordenador'),
        ('supervisor', 'Supervisor Geral')
    ]
    tipo = models.CharField(max_length=20, choices=tipo_choices, default='coordenador', verbose_name="Tipo")
    
    data_fim = models.DateField(blank=True, null=True, verbose_name="Data de Fim")
    ativo = models.BooleanField(default=True, verbose_name="Ativo")
    
    def save(self, *args, **kwargs):
        # Se a coordenação está sendo inativada e não tem data de fim, define agora.
        if not self.ativo and self.data_fim is None:
            self.data_fim = timezone.now().date()
        
        # Se está reativando uma coordenação que tinha data_fim, limpar data_fim.
        if self.ativo and self.data_fim is not None:
            self.data_fim = None
            
        super().save(*args, **kwargs)
    
    def __str__(self):
        status = "Ativa" if self.ativo else f"Finalizada em {self.data_fim.strftime('%d/%m/%Y') if self.data_fim else '-'}"
        return f"{self.funcionario.nome_completo} - {self.get_tipo_display()} de {self.sala.nome} ({status})"
    
    class Meta:
        verbose_name = 'Coordenador/Supervisor de Sala'
        verbose_name_plural = 'Coordenadores/Supervisores de Salas'
        ordering = ['sala__nome', 'funcionario__nome_completo']
        unique_together = ('funcionario', 'sala', 'tipo')  # Um funcionário não pode ter o mesmo tipo de coordenação na mesma sala

class Ramal(models.Model):
    numero = models.CharField(max_length=20, unique=True, verbose_name="Número do Ramal")
    funcionario = models.OneToOneField(
        Funcionario, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='ramal_ti', 
        verbose_name="Funcionário"
    )
    setor = models.ForeignKey(
        Setor, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='ramais_ti', 
        verbose_name="Setor"
    )

    def __str__(self):
        if self.funcionario:
            return f"{self.numero} - {self.funcionario.nome_completo}"
        return f"{self.numero} - (Disponível)"

    class Meta:
        verbose_name = 'Ramal'
        verbose_name_plural = 'Ramais'
        ordering = ['numero']