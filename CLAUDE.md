# claude-skill-builder

โปรเจกต์นี้ใช้กลยุทธ์ "คิดด้วย Opus ทำด้วย Sonnet" เพื่อสร้าง Claude Skill ที่ดีโดยไม่เปลือง token

## กติกาเลือกโมเดล
- ออกแบบ/คิดโครง skill ใหม่ (โครงสร้าง เผื่อ edge case เขียน description + trigger) ใช้ Opus
- ใช้/รัน skill ซ้ำๆ ที่โครงนิ่งแล้ว ใช้ Sonnet
- งานง่ายมาก (จัดรูปแบบ สรุปสั้น) ใช้ Haiku

## เวิร์กโฟลว์
- สร้าง skill ใหม่: เรียก subagent `skill-designer` (Opus)
- ทดสอบ/ใช้งาน: เรียก subagent `skill-runner` (Sonnet)
- ทุก SKILL.md เก็บใน `skills/<ชื่อ>/SKILL.md` ตามฟอร์แมต Agent Skills

## หลักการเขียน skill ที่ดี
- description บอกชัดว่า "ทำอะไร" และ "trigger เมื่อไหร่" ใส่ทั้งคำไทยและอังกฤษ
- ขั้นตอนสั้น ชัด ทำตามได้จริง
- เผื่อกรณีข้อมูลไม่ครบ ให้ถามก่อนทำ ไม่เดา
- อย่าแต่งเติมข้อมูลที่ผู้ใช้ไม่ได้ให้มา
