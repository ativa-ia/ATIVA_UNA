"""
Serviço para geração de relatórios em PDF
"""
from reportlab.lib import colors as pdf_colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from datetime import datetime
import os


def generate_quiz_report_pdf(quiz_data, ranking_data, output_path):
    """
    Gera relatório PDF do quiz
    
    Args:
        quiz_data: Dados do quiz (dict)
        ranking_data: Dados do ranking (list)
        output_path: Caminho para salvar o PDF
    
    Returns:
        str: Caminho do arquivo gerado
    """
    # Criar documento
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=18,
    )
    
    # Container para elementos do PDF
    elements = []
    
    # Estilos
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=pdf_colors.HexColor('#8b5cf6'),
        spaceAfter=30,
        alignment=TA_CENTER,
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=pdf_colors.HexColor('#4b5563'),
        spaceAfter=12,
    )
    
    # Título
    title = Paragraph(f"🏆 Relatório do Quiz: {quiz_data.get('title', 'Quiz')}", title_style)
    elements.append(title)
    elements.append(Spacer(1, 12))
    
    # Informações gerais
    info_data = [
        ['Data de Geração:', datetime.now().strftime('%d/%m/%Y %H:%M')],
        ['Status:', quiz_data.get('status', 'N/A').upper()],
        ['Tempo Limite:', f"{quiz_data.get('time_limit', 0) // 60} minutos"],
        ['Total de Questões:', str(quiz_data.get('question_count', 0))],
    ]
    
    info_table = Table(info_data, colWidths=[2*inch, 3*inch])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), pdf_colors.HexColor('#f3f4f6')),
        ('TEXTCOLOR', (0, 0), (-1, -1), pdf_colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, pdf_colors.grey),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 20))
    
    # Estatísticas
    stats = ranking_data
    enrolled_count = stats.get('enrolled_count', 0)
    response_count = stats.get('response_count', 0)
    
    elements.append(Paragraph("📊 Estatísticas Gerais", heading_style))
    
    stats_data = [
        ['Alunos Matriculados:', str(enrolled_count)],
        ['Respostas Recebidas:', str(response_count)],
        ['Taxa de Participação:', f"{stats.get('response_count', 0) / enrolled_count * 100:.1f}%" if enrolled_count > 0 else '0%'],
    ]
    
    # Calcular média de pontos se houver ranking
    if stats.get('ranking'):
        avg_points = sum(s['points'] for s in stats['ranking']) / len(stats['ranking'])
        avg_percentage = sum(s['percentage'] for s in stats['ranking']) / len(stats['ranking'])
        stats_data.extend([
            ['Média de Pontos:', f"{avg_points:.0f} pts"],
            ['Média de Acertos:', f"{avg_percentage:.1f}%"],
        ])
    
    stats_table = Table(stats_data, colWidths=[2.5*inch, 2.5*inch])
    stats_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), pdf_colors.HexColor('#dbeafe')),
        ('TEXTCOLOR', (0, 0), (-1, -1), pdf_colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, pdf_colors.grey),
    ]))
    elements.append(stats_table)
    elements.append(Spacer(1, 20))
    
    # Ranking completo
    if stats.get('ranking'):
        elements.append(Paragraph("🏅 Ranking Completo", heading_style))
        
        ranking_data_table = [['Pos.', 'Nome', 'Pontos', 'Acertos', 'Tempo (s)']]
        
        for student in stats['ranking']:
            ranking_data_table.append([
                f"{student['position']}º",
                student['student_name'][:30],  # Limitar nome
                f"{student['points']} pts",
                f"{student['score']}/{student['total']} ({student['percentage']:.0f}%)",
                str(student.get('time_taken', 0)),
            ])
        
        ranking_table = Table(ranking_data_table, colWidths=[0.6*inch, 2.2*inch, 1*inch, 1.2*inch, 1*inch])
        ranking_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), pdf_colors.HexColor('#8b5cf6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), pdf_colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), pdf_colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, pdf_colors.black),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            # Destacar top 3
            ('BACKGROUND', (0, 1), (-1, 1), pdf_colors.HexColor('#ffd700')),  # Ouro
            ('BACKGROUND', (0, 2), (-1, 2), pdf_colors.HexColor('#c0c0c0')),  # Prata
            ('BACKGROUND', (0, 3), (-1, 3), pdf_colors.HexColor('#cd7f32')),  # Bronze
        ]))
        elements.append(ranking_table)
    
    # Construir PDF
    doc.build(elements)
    
    return output_path


def generate_activity_report_pdf(activity_data, ranking_data, output_path):
    """
    Gera relatório PDF de atividade ao vivo (live activity)
    
    Args:
        activity_data: Dados da atividade (dict)
        ranking_data: Dados do ranking (dict)
        output_path: Caminho para salvar o PDF
    
    Returns:
        str: Caminho do arquivo gerado
    """
    # Criar documento
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=18,
    )
    
    # Container para elementos do PDF
    elements = []
    
    # Estilos
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=pdf_colors.HexColor('#8b5cf6'),
        spaceAfter=30,
        alignment=TA_CENTER,
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=pdf_colors.HexColor('#4b5563'),
        spaceAfter=12,
    )
    
    # Título
    activity_type_emoji = {
        'quiz': '📝',
        'summary': '📄',
        'open_question': '💭'
    }
    emoji = activity_type_emoji.get(activity_data.get('activity_type', 'quiz'), '🏆')
    title = Paragraph(f"{emoji} Relatório: {activity_data.get('title', 'Atividade')}", title_style)
    elements.append(title)
    elements.append(Spacer(1, 12))
    
    # Informações gerais
    info_data = [
        ['Data de Geração:', datetime.now().strftime('%d/%m/%Y %H:%M')],
        ['Status:', activity_data.get('status', 'N/A').upper()],
        ['Tipo:', activity_data.get('activity_type', 'N/A').replace('_', ' ').title()],
        ['Tempo Limite:', f"{activity_data.get('time_limit', 0) // 60} minutos"],
    ]
    
    info_table = Table(info_data, colWidths=[2*inch, 3*inch])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), pdf_colors.HexColor('#f3f4f6')),
        ('TEXTCOLOR', (0, 0), (-1, -1), pdf_colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, pdf_colors.grey),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 20))
    
    # Estatísticas
    enrolled_count = ranking_data.get('enrolled_count', 0)
    response_count = ranking_data.get('response_count', 0)
    
    elements.append(Paragraph("📊 Estatísticas Gerais", heading_style))
    
    stats_data = [
        ['Alunos Matriculados:', str(enrolled_count)],
        ['Respostas Recebidas:', str(response_count)],
        ['Taxa de Participação:', f"{(response_count / enrolled_count * 100):.1f}%" if enrolled_count > 0 else '0%'],
    ]
    
    # Calcular média de pontos se houver ranking
    ranking_list = ranking_data.get('ranking', [])
    if ranking_list:
        avg_points = sum(s['points'] for s in ranking_list) / len(ranking_list)
        avg_percentage = sum(s['percentage'] for s in ranking_list) / len(ranking_list)
        stats_data.extend([
            ['Média de Pontos:', f"{avg_points:.0f} pts"],
            ['Média de Acertos:', f"{avg_percentage:.1f}%"],
        ])
    
    stats_table = Table(stats_data, colWidths=[2.5*inch, 2.5*inch])
    stats_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), pdf_colors.HexColor('#dbeafe')),
        ('TEXTCOLOR', (0, 0), (-1, -1), pdf_colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, pdf_colors.grey),
    ]))
    elements.append(stats_table)
    elements.append(Spacer(1, 20))
    
    # Ranking completo
    if ranking_list:
        elements.append(Paragraph("🏅 Ranking Completo", heading_style))
        
        ranking_data_table = [['Pos.', 'Nome', 'Pontos', 'Acertos', 'Tempo (s)']]
        
        for student in ranking_list:
            ranking_data_table.append([
                f"{student['position']}º",
                student['student_name'][:30],  # Limitar nome
                f"{student['points']} pts",
                f"{student['score']}/{student['total']} ({student['percentage']:.0f}%)",
                str(student.get('time_taken', 0)),
            ])
        
        ranking_table = Table(ranking_data_table, colWidths=[0.6*inch, 2.2*inch, 1*inch, 1.2*inch, 1*inch])
        ranking_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), pdf_colors.HexColor('#8b5cf6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), pdf_colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), pdf_colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, pdf_colors.black),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            # Destacar top 3
            ('BACKGROUND', (0, 1), (-1, 1), pdf_colors.HexColor('#ffd700')),  # Ouro
            ('BACKGROUND', (0, 2), (-1, 2), pdf_colors.HexColor('#c0c0c0')),  # Prata
            ('BACKGROUND', (0, 3), (-1, 3), pdf_colors.HexColor('#cd7f32')),  # Bronze
        ]))
        elements.append(ranking_table)
    
    # Construir PDF
    doc.build(elements)
    
    return output_path
