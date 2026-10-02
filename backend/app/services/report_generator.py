import io
from typing import List, Dict, Any
from datetime import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

class ReportGeneratorService:
    @staticmethod
    def generate_excel_report(
        course_name: str,
        course_code: str,
        faculty_name: str,
        students_data: List[Dict[str, Any]],
        session_dates: List[str]
    ) -> io.BytesIO:
        """
        Generates a styled Excel attendance sheet using openpyxl.
        """
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = f"{course_code} Attendance"

        # Palettes (BPIT Design System)
        NAVY_FILL = PatternFill(start_color="162456", end_color="162456", fill_type="solid")
        MAROON_FILL = PatternFill(start_color="991B1B", end_color="991B1B", fill_type="solid")
        GREEN_FILL = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
        RED_FILL = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
        AMBER_FILL = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
        LIGHT_GRAY_FILL = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")

        WHITE_FONT = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        HEADER_FONT = Font(name="Calibri", size=14, bold=True, color="162456")
        SUB_FONT = Font(name="Calibri", size=10, italic=True, color="475569")
        BOLD_FONT = Font(name="Calibri", size=10, bold=True)
        REG_FONT = Font(name="Calibri", size=10)

        thin_border = Border(
            left=Side(style='thin', color='CBD5E1'),
            right=Side(style='thin', color='CBD5E1'),
            top=Side(style='thin', color='CBD5E1'),
            bottom=Side(style='thin', color='CBD5E1')
        )

        # Title Block
        ws.merge_cells("A1:G1")
        ws["A1"] = "BHAGWAN PARSHURAM INSTITUTE OF TECHNOLOGY (GGSIPU)"
        ws["A1"].font = HEADER_FONT
        ws["A1"].alignment = Alignment(horizontal="center", vertical="center")

        ws.merge_cells("A2:G2")
        ws["A2"] = f"Department of Information Technology — Course Attendance Register"
        ws["A2"].font = SUB_FONT
        ws["A2"].alignment = Alignment(horizontal="center", vertical="center")

        # Metadata info
        ws["A4"] = "Course:"
        ws["B4"] = f"{course_name} ({course_code})"
        ws["A4"].font = BOLD_FONT

        ws["A5"] = "Faculty:"
        ws["B5"] = faculty_name
        ws["A5"].font = BOLD_FONT

        ws["D4"] = "Exported On:"
        ws["E4"] = datetime.now().strftime("%d %b %Y, %I:%M %p")
        ws["D4"].font = BOLD_FONT

        ws["D5"] = "Total Classes:"
        ws["E5"] = len(session_dates)
        ws["D5"].font = BOLD_FONT

        # Table Header Row
        headers = ["S.No", "Enrollment No", "Student Name"] + session_dates + ["Total Attended", "Total Classes", "Attendance %", "Status"]
        start_row = 7
        for col_idx, header in enumerate(headers, 1):
            cell = ws.cell(row=start_row, column=col_idx, value=header)
            cell.fill = NAVY_FILL
            cell.font = WHITE_FONT
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = thin_border

        # Student Records Rows
        for s_idx, student in enumerate(students_data, 1):
            curr_row = start_row + s_idx
            ws.cell(row=curr_row, column=1, value=s_idx).alignment = Alignment(horizontal="center")
            ws.cell(row=curr_row, column=2, value=student.get("enrollment_no", "")).alignment = Alignment(horizontal="center")
            ws.cell(row=curr_row, column=3, value=student.get("full_name", "")).alignment = Alignment(horizontal="left")

            # Date columns
            session_statuses = student.get("session_statuses", [])
            for d_idx, status in enumerate(session_statuses):
                col = 4 + d_idx
                cell = ws.cell(row=curr_row, column=col, value="—" if status == "not_enrolled" else "P" if status == "present" else ("R" if status == "pending_review" else "A"))
                cell.alignment = Alignment(horizontal="center")
                if status == "present":
                    cell.fill = GREEN_FILL
                elif status == "pending_review":
                    cell.fill = AMBER_FILL
                elif status != "not_enrolled":
                    cell.fill = RED_FILL
                cell.border = thin_border

            # Statistics columns
            attended = student.get("attended", 0)
            total = student.get("total", len(session_dates))
            pct = round((attended / total * 100), 1) if total > 0 else 0.0

            stat_col_start = 4 + len(session_dates)
            ws.cell(row=curr_row, column=stat_col_start, value=attended).alignment = Alignment(horizontal="center")
            ws.cell(row=curr_row, column=stat_col_start + 1, value=total).alignment = Alignment(horizontal="center")
            
            pct_cell = ws.cell(row=curr_row, column=stat_col_start + 2, value=f"{pct}%")
            pct_cell.alignment = Alignment(horizontal="center")
            pct_cell.font = BOLD_FONT

            status_cell = ws.cell(row=curr_row, column=stat_col_start + 3, value="Eligible" if pct >= 75.0 else "At Risk (<75%)")
            status_cell.alignment = Alignment(horizontal="center")
            if pct >= 75.0:
                status_cell.fill = GREEN_FILL
            else:
                status_cell.fill = RED_FILL

            for c in range(1, stat_col_start + 4):
                ws.cell(row=curr_row, column=c).border = thin_border

        # Adjust column widths
        for col in ws.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = openpyxl.utils.get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = min(max(max_len + 3, 11), 30)
        ws.column_dimensions['A'].width = 8
        ws.column_dimensions['B'].width = 20
        ws.column_dimensions['C'].width = 28
        ws.freeze_panes = 'D8'
        ws.auto_filter.ref = f"A7:{openpyxl.utils.get_column_letter(len(headers))}{7 + len(students_data)}"

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output

    @staticmethod
    def generate_pdf_report(
        course_name: str,
        course_code: str,
        faculty_name: str,
        students_data: List[Dict[str, Any]],
        total_classes: int
    ) -> io.BytesIO:
        """
        Generates an official formatted PDF attendance report using reportlab.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=15,
            leading=18,
            textColor=colors.HexColor('#162456'),
            alignment=1
        )
        subtitle_style = ParagraphStyle(
            'SubtitleStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=14,
            textColor=colors.HexColor('#475569'),
            alignment=1
        )
        info_style = ParagraphStyle(
            'InfoStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=13,
            textColor=colors.HexColor('#1e293b')
        )

        elements = []

        # College Header
        elements.append(Paragraph("BHAGWAN PARSHURAM INSTITUTE OF TECHNOLOGY", title_style))
        elements.append(Paragraph("Affiliated to GGSIP University, New Delhi | Department of Information Technology", subtitle_style))
        elements.append(Paragraph("OFFICIAL ATTENDANCE REPORT", ParagraphStyle('ReportType', parent=subtitle_style, fontName='Helvetica-Bold', textColor=colors.HexColor('#991b1b'))))
        elements.append(Spacer(1, 14))

        # Course Information Box
        info_data = [
            [f"<b>Course:</b> {course_name} ({course_code})", f"<b>Faculty:</b> {faculty_name}"],
            [f"<b>Total Classes Held:</b> {total_classes}", f"<b>Report Date:</b> {datetime.now().strftime('%d %B %Y')}"],
            ["<b>Attendance Threshold:</b> 75.0% (Mandatory for Semester Exam Eligibility)", f"<b>Total Enrolled:</b> {len(students_data)}"]
        ]
        info_table = Table(
            [[Paragraph(cell, info_style) for cell in row] for row in info_data],
            colWidths=[260, 260]
        )
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 14))

        # Students Table
        table_data = [["S.No", "Enrollment No", "Student Name", "Held", "Attended", "Attendance %", "Status"]]
        for idx, s in enumerate(students_data, 1):
            att = s.get("attended", 0)
            tot = s.get("total", total_classes)
            pct = round((att / tot * 100), 1) if tot > 0 else 0.0
            status_str = "Eligible" if pct >= 75.0 else "At Risk (<75%)"
            table_data.append([
                str(idx),
                s.get("enrollment_no", ""),
                s.get("full_name", ""),
                str(tot),
                str(att),
                f"{pct}%",
                status_str
            ])

        col_widths = [35, 95, 160, 45, 55, 65, 65]
        student_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        student_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#162456')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (2, 1), (2, -1), 'LEFT'), # Left align student name
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')])
        ]))
        elements.append(student_table)
        elements.append(Spacer(1, 35))

        # Signatures
        sig_data = [
            ["____________________________________", "____________________________________"],
            [f"Course Faculty ({faculty_name})", "Head of Department (IT), BPIT"]
        ]
        sig_table = Table(sig_data, colWidths=[260, 260])
        sig_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#334155')),
        ]))
        elements.append(sig_table)

        doc.build(elements)
        buffer.seek(0)
        return buffer

report_service = ReportGeneratorService()
