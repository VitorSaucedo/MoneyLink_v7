# Generated by Django 5.1 on 2025-05-07 15:39

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inss', '0004_alter_presencaloja_tabulacao_venda'),
    ]

    operations = [
        migrations.AlterField(
            model_name='presencaloja',
            name='agendamento',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='presencas', to='inss.agendamento', verbose_name='Agendamento Associado'),
        ),
    ]
