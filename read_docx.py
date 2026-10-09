import zipfile
import xml.etree.ElementTree as ET

def read_docx(path):
    with zipfile.ZipFile(path) as docx:
        xml_content = docx.read('word/document.xml')
        tree = ET.XML(xml_content)
        namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        
        paragraphs = []
        for p in tree.findall('.//w:p', namespaces):
            texts = p.findall('.//w:t', namespaces)
            if texts:
                paragraphs.append(''.join([t.text for t in texts if t.text]))
        return '\n'.join(paragraphs)

print(read_docx('Pharmacy_Label_Software_SRS.docx'))
