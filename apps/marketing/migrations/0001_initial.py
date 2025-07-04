# Generated by Django 5.1 on 2025-06-05 11:36

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Produto',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('titulo', models.CharField(max_length=200, verbose_name='Título')),
                ('data_criacao', models.DateTimeField(default=django.utils.timezone.now, help_text='Armazenada em UTC, exibida no timezone local', verbose_name='Data de Criação')),
                ('status', models.BooleanField(default=True, verbose_name='Status Ativo')),
            ],
            options={
                'verbose_name': 'Produto',
                'verbose_name_plural': 'Produtos',
                'ordering': ['-data_criacao'],
            },
        ),
        migrations.CreateModel(
            name='Material',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('titulo', models.CharField(max_length=200, verbose_name='Título')),
                ('banner', models.ImageField(blank=True, null=True, upload_to='marketing/banners/', verbose_name='Banner')),
                ('arquivo', models.FileField(upload_to='marketing/arquivos/', verbose_name='Arquivo')),
                ('data_criacao', models.DateTimeField(default=django.utils.timezone.now, help_text='Armazenada em UTC, exibida no timezone local', verbose_name='Data de Criação')),
                ('status', models.BooleanField(default=True, verbose_name='Status Ativo')),
                ('produto', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='materiais', to='marketing.produto', verbose_name='Produto')),
            ],
            options={
                'verbose_name': 'Material',
                'verbose_name_plural': 'Materiais',
                'ordering': ['-data_criacao'],
            },
        ),
        migrations.CreateModel(
            name='DownloadsMaterial',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('data', models.DateTimeField(default=django.utils.timezone.now, help_text='Timestamp UTC do download, exibido no timezone local', verbose_name='Data e Hora do Download')),
                ('ip_usuario', models.GenericIPAddressField(blank=True, null=True, verbose_name='IP do Usuário')),
                ('status', models.BooleanField(default=True, verbose_name='Download Válido')),
                ('usuario', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='downloads_realizados', to=settings.AUTH_USER_MODEL, verbose_name='Usuário')),
                ('material', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='downloads', to='marketing.material', verbose_name='Material')),
                ('produto', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='downloads_realizados', to='marketing.produto', verbose_name='Produto')),
            ],
            options={
                'verbose_name': 'Registro de Download',
                'verbose_name_plural': 'Registros de Downloads',
                'ordering': ['-data'],
                'indexes': [models.Index(fields=['material', 'data'], name='marketing_d_materia_1117c0_idx'), models.Index(fields=['produto', 'data'], name='marketing_d_produto_097e84_idx'), models.Index(fields=['usuario', 'data'], name='marketing_d_usuario_d81e07_idx'), models.Index(fields=['data'], name='marketing_d_data_ab82e1_idx')],
            },
        ),
    ]
