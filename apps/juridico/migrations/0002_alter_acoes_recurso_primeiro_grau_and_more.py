# Generated by Django 5.1 on 2025-05-30 09:58

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('juridico', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='acoes',
            name='recurso_primeiro_grau',
            field=models.CharField(blank=True, choices=[('NENHUM', 'Nenhum'), ('APELACAO', 'Apelação'), ('AGRAVO', 'Agravo'), ('EMBARGOS', 'Embargos'), ('NOMINADO', 'Nominado')], default='NENHUM', max_length=20, null=True, verbose_name='Recurso 1º Grau'),
        ),
        migrations.AlterField(
            model_name='acoes',
            name='recurso_segundo_grau',
            field=models.CharField(blank=True, choices=[('NENHUM', 'Nenhum'), ('APELACAO', 'Apelação'), ('AGRAVO', 'Agravo'), ('EMBARGOS', 'Embargos'), ('NOMINADO', 'Nominado')], default='NENHUM', max_length=20, null=True, verbose_name='Recurso 2º Grau'),
        ),
    ]
