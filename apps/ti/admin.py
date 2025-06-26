from django.contrib import admin
from .models import (
    TipoPeriferico, Periferico, Computador, Monitor, Sala, Ilha, 
    PosicaoAtendimento, AtribuicaoFuncionarioPA, AtribuicaoPerifericoPA,
    AtribuicaoComputadorPA, AtribuicaoMonitorPA, Chip, Email, Storm, Sistema
)

@admin.register(TipoPeriferico)
class TipoPerifericoAdmin(admin.ModelAdmin):
    list_display = ('nome', 'descricao')
    search_fields = ('nome', 'descricao')
    list_filter = ('nome',)
    ordering = ('nome',)

@admin.register(Periferico)
class PerifericoAdmin(admin.ModelAdmin):
    list_display = ('tipo', 'marca', 'modelo', 'numero_serie', 'loja', 'status', 'condicao', 'estado')
    list_filter = ('tipo', 'marca', 'loja', 'status', 'condicao', 'estado', 'data_aquisicao')
    search_fields = ('marca', 'modelo', 'numero_serie', 'observacoes')
    date_hierarchy = 'data_aquisicao'
    ordering = ('tipo', 'marca', 'modelo')
    list_per_page = 25
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('tipo', 'marca', 'modelo', 'numero_serie', 'quantidade')
        }),
        ('Localização e Status', {
            'fields': ('loja', 'status', 'condicao', 'estado')
        }),
        ('Outras Informações', {
            'fields': ('data_aquisicao', 'observacoes')
        }),
    )

@admin.register(Computador)
class ComputadorAdmin(admin.ModelAdmin):
    list_display = ('marca', 'quantidade', 'condicao', 'status', 'loja')
    list_filter = ('marca', 'condicao', 'status', 'loja')
    search_fields = ('marca', 'observacoes')
    ordering = ('marca',)
    list_per_page = 25
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('marca', 'quantidade')
        }),
        ('Status e Localização', {
            'fields': ('condicao', 'status', 'loja')
        }),
        ('Observações', {
            'fields': ('observacoes',)
        }),
    )

@admin.register(Monitor)
class MonitorAdmin(admin.ModelAdmin):
    list_display = ('marca', 'tamanho', 'condicao', 'status', 'loja')
    list_filter = ('marca', 'tamanho', 'condicao', 'status', 'loja')
    search_fields = ('marca', 'tamanho', 'observacoes')
    ordering = ('marca', 'tamanho')
    list_per_page = 25
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('marca', 'tamanho')
        }),
        ('Status e Localização', {
            'fields': ('condicao', 'status', 'loja')
        }),
        ('Observações', {
            'fields': ('observacoes',)
        }),
    )

@admin.register(Sala)
class SalaAdmin(admin.ModelAdmin):
    list_display = ('nome', 'titulo', 'loja', 'setor', 'status')
    list_filter = ('loja', 'setor')
    search_fields = ('nome', 'titulo', 'descricao')
    ordering = ('loja', 'nome')
    list_per_page = 25
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('nome', 'titulo')
        }),
        ('Localização', {
            'fields': ('loja', 'setor')
        }),
        ('Descrição', {
            'fields': ('descricao',)
        }),
    )

@admin.register(Ilha)
class IlhaAdmin(admin.ModelAdmin):
    list_display = ('nome', 'titulo', 'sala', 'quantidade_pas', 'loja', 'setor', 'status')
    list_filter = ('sala__loja', 'sala__setor', 'quantidade_pas')
    search_fields = ('nome', 'titulo', 'descricao', 'sala__nome')
    ordering = ('sala__loja', 'sala__nome', 'nome')
    list_per_page = 25
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('nome', 'titulo', 'sala')
        }),
        ('Configuração', {
            'fields': ('quantidade_pas',)
        }),
        ('Descrição', {
            'fields': ('descricao',)
        }),
    )

@admin.register(PosicaoAtendimento)
class PosicaoAtendimentoAdmin(admin.ModelAdmin):
    list_display = ('numero', 'titulo', 'ilha', 'sala', 'status', 'loja', 'setor', 'funcionario_atual')
    list_filter = ('status', 'ilha__sala__loja', 'ilha__sala__setor', 'sala__loja', 'sala__setor')
    search_fields = ('numero', 'titulo', 'observacoes', 'ilha__nome', 'sala__nome')
    ordering = ('ilha__sala__loja', 'ilha__nome', 'numero')
    list_per_page = 25
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('numero', 'titulo')
        }),
        ('Localização', {
            'fields': ('ilha', 'sala')
        }),
        ('Status', {
            'fields': ('status',)
        }),
        ('Observações', {
            'fields': ('observacoes',)
        }),
    )

@admin.register(AtribuicaoFuncionarioPA)
class AtribuicaoFuncionarioPAAdmin(admin.ModelAdmin):
    list_display = ('funcionario', 'posicao_atendimento', 'data_inicio', 'data_fim', 'ativo')
    list_filter = ('ativo', 'data_inicio', 'data_fim', 'posicao_atendimento__ilha__sala__loja')
    search_fields = ('funcionario__nome_completo', 'posicao_atendimento__numero')
    date_hierarchy = 'data_inicio'
    ordering = ('-data_inicio', 'funcionario__nome_completo')
    list_per_page = 25
    
    fieldsets = (
        ('Atribuição', {
            'fields': ('funcionario', 'posicao_atendimento')
        }),
        ('Período', {
            'fields': ('data_inicio', 'data_fim', 'ativo')
        }),
    )

@admin.register(AtribuicaoPerifericoPA)
class AtribuicaoPerifericoPAAdmin(admin.ModelAdmin):
    list_display = ('periferico', 'posicao_atendimento', 'data_atribuicao', 'data_remocao', 'ativo')
    list_filter = ('ativo', 'data_atribuicao', 'data_remocao', 'periferico__tipo', 'posicao_atendimento__ilha__sala__loja')
    search_fields = ('periferico__marca', 'periferico__modelo', 'posicao_atendimento__numero')
    date_hierarchy = 'data_atribuicao'
    ordering = ('-data_atribuicao',)
    list_per_page = 25
    
    fieldsets = (
        ('Atribuição', {
            'fields': ('periferico', 'posicao_atendimento')
        }),
        ('Período', {
            'fields': ('data_atribuicao', 'data_remocao', 'ativo')
        }),
    )

@admin.register(AtribuicaoComputadorPA)
class AtribuicaoComputadorPAAdmin(admin.ModelAdmin):
    list_display = ('computador', 'posicao_atendimento', 'data_atribuicao', 'data_remocao', 'ativo')
    list_filter = ('ativo', 'data_atribuicao', 'data_remocao', 'computador__marca', 'posicao_atendimento__ilha__sala__loja')
    search_fields = ('computador__marca', 'posicao_atendimento__numero')
    date_hierarchy = 'data_atribuicao'
    ordering = ('-data_atribuicao',)
    list_per_page = 25
    
    fieldsets = (
        ('Atribuição', {
            'fields': ('computador', 'posicao_atendimento')
        }),
        ('Período', {
            'fields': ('data_atribuicao', 'data_remocao', 'ativo')
        }),
    )

@admin.register(AtribuicaoMonitorPA)
class AtribuicaoMonitorPAAdmin(admin.ModelAdmin):
    list_display = ('monitor', 'posicao_atendimento', 'data_atribuicao', 'data_remocao', 'ativo')
    list_filter = ('ativo', 'data_atribuicao', 'data_remocao', 'monitor__marca', 'posicao_atendimento__ilha__sala__loja')
    search_fields = ('monitor__marca', 'posicao_atendimento__numero')
    date_hierarchy = 'data_atribuicao'
    ordering = ('-data_atribuicao',)
    list_per_page = 25
    
    fieldsets = (
        ('Atribuição', {
            'fields': ('monitor', 'posicao_atendimento')
        }),
        ('Período', {
            'fields': ('data_atribuicao', 'data_remocao', 'ativo')
        }),
    )

@admin.register(Chip)
class ChipAdmin(admin.ModelAdmin):
    list_display = ('numero', 'funcionario', 'ramal', 'setor', 'status', 'data_entrega')
    list_filter = ('status', 'data_entrega', 'data_criacao_recarga', 'data_banimento')
    search_fields = ('numero', 'funcionario__nome_completo', 'ramal__nome_completo', 'setor__nome_completo')
    date_hierarchy = 'data_criacao_recarga'
    ordering = ('numero',)
    list_per_page = 25
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('numero', 'status')
        }),
        ('Atribuições', {
            'fields': ('funcionario', 'ramal', 'setor')
        }),
        ('Datas', {
            'fields': ('data_entrega', 'data_criacao_recarga', 'data_banimento')
        }),
    )

@admin.register(Email)
class EmailAdmin(admin.ModelAdmin):
    list_display = ('email', 'funcionario', 'ramal', 'setor', 'status', 'tipo')
    list_filter = ('status', 'tipo', 'data_criacao', 'data_atualizacao')
    search_fields = ('email', 'funcionario__nome_completo', 'ramal__nome_completo', 'setor__nome_completo', 'email_recuperacao')
    date_hierarchy = 'data_criacao'
    ordering = ('email',)
    list_per_page = 25
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('email', 'senha', 'status', 'tipo')
        }),
        ('Atribuições', {
            'fields': ('funcionario', 'ramal', 'setor')
        }),
        ('Recuperação', {
            'fields': ('email_recuperacao',)
        }),
        ('Datas', {
            'fields': ('data_criacao', 'data_atualizacao')
        }),
    )
    
    readonly_fields = ('data_criacao', 'data_atualizacao')

@admin.register(Storm)
class StormAdmin(admin.ModelAdmin):
    list_display = ('funcionario', 'email_administrativo', 'usuario', 'situacao', 'ramal')
    list_filter = ('situacao',)
    search_fields = ('funcionario__nome_completo', 'email_administrativo', 'usuario')
    ordering = ('funcionario__nome_completo',)
    list_per_page = 25
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('funcionario', 'email_administrativo')
        }),
        ('Acesso', {
            'fields': ('usuario', 'senha', 'situacao')
        }),
    )

@admin.register(Sistema)
class SistemaAdmin(admin.ModelAdmin):
    list_display = ('funcionario', 'acesso', 'cargo', 'departamento_setor')
    list_filter = ('funcionario__cargo', 'funcionario__setor__departamento', 'funcionario__setor')
    search_fields = ('funcionario__nome_completo', 'acesso', 'funcionario__cargo__nome')
    ordering = ('funcionario__nome_completo', 'acesso')
    list_per_page = 25
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('funcionario', 'acesso')
        }),
        ('Credenciais', {
            'fields': ('senha',)
        }),
    )