# Generated by Django 5.1 on 2025-06-25 11:53

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('siape', '0017_remove_tabulacaocliente_cliente_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='dadosnegociacao',
            name='tc',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Valor TC (quanto a empresa recebe na operação)', max_digits=20, null=True, verbose_name='TC'),
        ),
    ]
