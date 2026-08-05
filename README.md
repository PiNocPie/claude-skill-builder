# 🛠️ Claude Skill Builder

**สร้าง skill ที่ดี โดยไม่เปลือง token: ให้ Claude "คิดด้วย Opus ทำด้วย Sonnet"**

ฟรี · ใช้กับ Claude Code · by [KingPrompt](https://kingprompt.co)

---

## แนวคิด

การสร้าง skill ที่ดีต้อง "คิดหนัก" ครั้งเดียว วางโครง เผื่อ edge case เขียน trigger ให้แม่น
แต่พอ skill เสร็จแล้ว การเอาไปใช้ซ้ำๆ คือโครงที่นิ่งแล้ว ไม่ต้องคิดเยอะ

เพราะงั้นเลือกโมเดลตามเฟสของงาน:

- 🧠 **ออกแบบ skill = Opus** คิดลึก คุ้มที่จ่ายแพงครั้งเดียว
- ⚡ **ใช้ skill ประจำวัน = Sonnet** เร็ว ประหยัด พอสำหรับงานที่โครงนิ่งแล้ว
- 🪶 งานจิ๊บๆ (จัดรูปแบบ สรุปสั้น) = Haiku

> จ่ายแพงตอนสร้างของดีครั้งเดียว แล้วใช้ของถูกไปตลอด

## มีอะไรใน kit นี้

| ไฟล์ | ทำอะไร |
|------|--------|
| `CLAUDE.md` | เซ็ตกลยุทธ์โมเดลไว้ให้ Claude อ่านอัตโนมัติ |
| `.claude/agents/skill-designer.md` | subagent ออกแบบ skill (ตั้งไว้ใช้ Opus) |
| `.claude/agents/skill-runner.md` | subagent ใช้งาน skill (ตั้งไว้ใช้ Sonnet) |
| `.claude/commands/new-skill.md` | พิมพ์ `/new-skill` เพื่อสร้าง skill ใหม่ |
| `templates/SKILL.template.md` | เทมเพลตเปล่าเขียน skill |
| `examples/` | ตัวอย่าง skill ที่สร้างด้วยวิธีนี้ |

## เริ่มยังไง

1. โคลน repo นี้ หรือก็อปโฟลเดอร์ `.claude/` กับ `CLAUDE.md` ไปวางในโปรเจกต์ของคุณ
2. เปิด Claude Code ในโฟลเดอร์นี้
3. พิมพ์ `/new-skill <ไอเดีย skill ที่อยากได้>`
4. `skill-designer` (Opus) จะออกแบบและเขียน SKILL.md ให้
5. เอาไปใช้จริงประจำวันด้วย `skill-runner` (Sonnet) ได้เลย

## หมายเหตุแบบตรงๆ

นี่คือ **เวิร์กโฟลว์ + การตั้งค่า** ไม่ใช่เวทมนตร์อัตโนมัติ 100 เปอร์เซ็นต์
คุณยังเป็นคนสั่ง สลับ และตรวจงานอยู่ การตั้ง `model` ใน subagent แค่ช่วยให้
Claude Code หยิบโมเดลที่เหมาะกับแต่ละเฟสให้เอง แต่คุณคุมทิศทางเสมอ

---

💙 ถ้า kit นี้มีประโยชน์ กดฟอลเป็นกำลังใจได้ที่ [@kingprompt.th](https://www.instagram.com/kingprompt.th/) · รวมของฟรีอื่นๆ ที่ [kingprompt.co](https://kingprompt.co)
