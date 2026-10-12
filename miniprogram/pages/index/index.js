const { request } = require('../../utils/api')
const { dayNow, timeNow, medicationDays, inRange, report } = require('../../utils/domain')
const { validateRecord, validateBackup } = require('../../utils/schema')
const symptomOptions = ['畏寒', '肌肉酸痛', '关节痛', '皮疹', '咳嗽', '乏力', '其他']
const labNames = [
  '铁蛋白 Ferritin',
  'CRP',
  '血沉 ESR',
  '白细胞 WBC',
  '中性粒细胞',
  '血红蛋白 Hb',
  '血小板 PLT',
  'ALT',
  'AST',
  'LDH',
  '甘油三酯 TG',
  '纤维蛋白原'
]
const f = (key, label, type = 'text', options = []) => ({ key, label, type, options })
const forms = {
  temperatures: [
    f('measuredAt', '测量日期和时间', 'datetime'),
    f('value', '体温 ℃', 'digit'),
    f('method', '测量方式', 'select', ['腋温', '口温', '耳温', '其他']),
    f('symptoms', '症状', 'symptoms'),
    f('note', '备注', 'textarea')
  ],
  medications: [
    f('name', '药品名称'),
    f('spec', '每片/支规格（如 4mg/片）'),
    f('unit', '每次剂量单位'),
    f('dose', '每次剂量', 'digit'),
    f('frequency', '每日次数', 'number'),
    f('route', '途径', 'select', ['口服', '静脉输液', '肌注', '其他']),
    f('startDate', '开始日期', 'date'),
    f('endDate', '结束日期（可空）', 'date'),
    f('note', '备注及医生交代', 'textarea')
  ],
  medicationLogs: [
    f('medicationId', '选择处方方案', 'medication'),
    f('occurredAt', '实际时间', 'datetime'),
    f('dose', '实际剂量', 'digit'),
    f('missed', '是否漏服', 'switch'),
    f('note', '备注', 'textarea')
  ],
  labs: [
    f('testedAt', '检测日期', 'date'),
    f('name', '指标名称（支持自定义）'),
    f('value', '数值', 'digit'),
    f('unit', '单位'),
    f('reference', '参考范围'),
    f('hospital', '医院'),
    f('note', '备注', 'textarea')
  ],
  events: [
    f('occurredAt', '事件时间（YYYY-MM-DDTHH:mm）'),
    f('title', '事件标题'),
    f('detail', '事件详情', 'textarea')
  ]
}
function blank(k) {
  return {
    temperatures: { measuredAt: timeNow(), value: '', method: '腋温', symptoms: [], note: '' },
    medications: {
      name: '',
      spec: '',
      unit: '片',
      dose: '',
      frequency: 1,
      route: '口服',
      startDate: dayNow(),
      endDate: '',
      note: ''
    },
    medicationLogs: { medicationId: '', occurredAt: timeNow(), dose: '', missed: false, note: '' },
    labs: {
      testedAt: dayNow(),
      name: 'CRP',
      value: '',
      unit: '',
      reference: '',
      hospital: '',
      note: ''
    },
    events: { occurredAt: timeNow(), title: '', detail: '' }
  }[k]
}
Page({
  data: {
    accessKey: '',
    tab: 'home',
    tabs: [
      { key: 'home', label: '首页' },
      { key: 'temperatures', label: '体温' },
      { key: 'medications', label: '用药' },
      { key: 'labs', label: '化验' },
      { key: 'trend', label: '趋势/报告' }
    ],
    temperatures: [],
    medications: [],
    medicationLogs: [],
    labs: [],
    events: [],
    activeMeds: [],
    latestLabs: [],
    maxToday: '—',
    latestText: '暂无记录',
    resource: 'temperatures',
    fields: forms.temperatures,
    form: blank('temperatures'),
    editId: '',
    error: '',
    busy: false,
    symptomOptions: symptomOptions.map(s => ({ name: s, checked: false })),
    labNames,
    from: dayNow(),
    to: dayNow(),
    labKeys: [],
    labIndex: 0,
    summary: '',
    timeline: [],
    medNames: [],
    logMode: false
  },
  connect() {
    wx.setStorageSync('kangcheng-access-key', this.data.accessKey)
    this.reload()
  },
  keyInput(e) {
    this.setData({ accessKey: e.detail.value })
  },
  onLoad() {
    this.rangeDays(7)
    this.reload()
  },
  async run(fn) {
    if (this.data.busy) return
    this.setData({ busy: true, error: '' })
    try {
      await fn()
    } catch (e) {
      this.setData({ error: e.message || '操作失败' })
    } finally {
      this.setData({ busy: false })
    }
  },
  async reload() {
    await this.run(async () => {
      const resources = ['temperatures', 'medications', 'medicationLogs', 'labs', 'events']
      const results = await Promise.all(resources.map(k => request('/' + k)))
      const data = {}
      resources.forEach((k, i) => (data[k] = results[i].data))
      data.temperatures.sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
      data.labs.sort((a, b) => b.testedAt.localeCompare(a.testedAt))
      data.medications = data.medications.map(m => ({ ...m, days: medicationDays(m) }))
      data.activeMeds = data.medications.filter(
        m => m.startDate <= dayNow() && (!m.endDate || m.endDate >= dayNow())
      )
      data.latestLabs = data.labs.filter(l => l.testedAt === data.labs[0]?.testedAt)
      const today = data.temperatures.filter(t => t.measuredAt.startsWith(dayNow()))
      data.maxToday = today.length ? Math.max(...today.map(t => t.value)).toFixed(1) + '℃' : '—'
      data.latestText = data.temperatures.length
        ? data.temperatures[0].value + '℃ · ' + data.temperatures[0].measuredAt.replace('T', ' ')
        : '暂无记录'
      data.medNames = data.medications.map(m => m.name + '（' + m.unit + '）')
      data.labKeys = Array.from(new Set(data.labs.map(l => l.name + ' | ' + l.unit)))
      data.medicationLogs = data.medicationLogs.map(l => ({
        ...l,
        name: data.medications.find(m => m.id === l.medicationId)?.name || '未知药品'
      }))
      this.setData(data)
      this.updateTrend()
    })
  },
  selectTab(e) {
    const tab = e.currentTarget.dataset.key
    this.setData({ tab, logMode: false, editId: '' })
    if (forms[tab])
      this.setData({
        resource: tab,
        fields: forms[tab],
        form: blank(tab),
        symptomOptions: symptomOptions.map(s => ({ name: s, checked: false }))
      })
    if (tab === 'trend') {
      this.eventMode()
      this.updateTrend()
    }
  },
  datePart(e) {
    const key = e.currentTarget.dataset.key,
      part = e.currentTarget.dataset.part
    const old = this.data.form[key] || timeNow()
    this.setData({
      ['form.' + key]:
        part === 'date'
          ? e.detail.value + 'T' + old.slice(11, 16)
          : old.slice(0, 10) + 'T' + e.detail.value
    })
  },
  fieldInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ ['form.' + key]: e.detail.value })
  },
  selectField(e) {
    const key = e.currentTarget.dataset.key
    const field = this.data.fields.find(f => f.key === key)
    const value =
      field.type === 'medication'
        ? this.data.medications[Number(e.detail.value)]?.id
        : field.options[Number(e.detail.value)]
    this.setData({
      ['form.' + key]:
        key === 'changeMode' ? (Number(e.detail.value) === 0 ? 'adjustment' : 'correction') : value
    })
  },
  symptomChange(e) {
    this.setData({
      'form.symptoms': e.detail.value,
      symptomOptions: symptomOptions.map(s => ({ name: s, checked: e.detail.value.includes(s) }))
    })
  },
  logToggle() {
    const k = this.data.logMode ? 'medications' : 'medicationLogs'
    this.setData({
      logMode: !this.data.logMode,
      resource: k,
      fields: forms[k],
      form: blank(k),
      editId: ''
    })
  },
  eventMode() {
    this.setData({ resource: 'events', fields: forms.events, form: blank('events'), editId: '' })
  },
  chooseIndicator(e) {
    this.setData({ 'form.name': labNames[Number(e.detail.value)] })
  },
  async save() {
    const k = this.data.resource
    const x = { ...this.data.form }
    for (const f of ['value', 'dose', 'frequency'])
      if (f in x) x[f] = x[f] === '' ? NaN : Number(x[f])
    let payload
    try {
      payload = validateRecord(k, x)
      if (k === 'medications') {
        payload.changeMode = x.changeMode
        payload.effectiveDate = x.effectiveDate
      }
    } catch (e) {
      return this.setData({ error: e.message })
    }
    await this.run(async () => {
      await request(
        '/' + k + (this.data.editId ? '/' + this.data.editId : ''),
        this.data.editId ? 'PUT' : 'POST',
        payload
      )
      this.setData({
        editId: '',
        form: blank(k),
        symptomOptions: symptomOptions.map(s => ({ name: s, checked: false }))
      })
      wx.showToast({ title: '保存成功' })
    })
    if (!this.data.error) await this.reload()
  },
  edit(e) {
    const k = e.currentTarget.dataset.resource
    const x = this.data[k].find(x => x.id === e.currentTarget.dataset.id)
    this.setData({
      resource: k,
      fields:
        k === 'medications'
          ? [
              ...forms[k],
              f('changeMode', '修改类型', 'select', ['调整方案（保留历史）', '修正录入错误']),
              f('effectiveDate', '调整生效日期', 'date')
            ]
          : forms[k],
      form: { ...JSON.parse(JSON.stringify(x)), changeMode: 'adjustment', effectiveDate: dayNow() },
      editId: x.id,
      symptomOptions: symptomOptions.map(s => ({
        name: s,
        checked: (x.symptoms || []).includes(s)
      })),
      logMode: k === 'medicationLogs'
    })
    wx.pageScrollTo({ scrollTop: 0 })
  },
  cancelEdit() {
    this.setData({
      editId: '',
      form: blank(this.data.resource),
      symptomOptions: symptomOptions.map(s => ({ name: s, checked: false }))
    })
  },
  async remove(e) {
    const k = e.currentTarget.dataset.resource,
      id = e.currentTarget.dataset.id
    const confirmed = await new Promise(resolve =>
      wx.showModal({
        title: '确认删除',
        content: k === 'medications' ? '将删除该方案及对应执行记录。' : '确定删除这条记录？',
        success: r => resolve(r.confirm)
      })
    )
    if (confirmed) {
      await this.run(() => request('/' + k + '/' + id, 'DELETE'))
      if (!this.data.error) await this.reload()
    }
  },
  rangeDays(n) {
    const d = new Date(dayNow() + 'T00:00:00')
    d.setDate(d.getDate() - n + 1)
    this.setData({
      from:
        d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0'),
      to: dayNow()
    })
    this.updateTrend()
  },
  rangeButton(e) {
    this.rangeDays(Number(e.currentTarget.dataset.days))
  },
  rangeChange(e) {
    this.setData({ [e.currentTarget.dataset.key]: e.detail.value })
    this.updateTrend()
  },
  labChange(e) {
    this.setData({ labIndex: Number(e.detail.value) })
    this.updateTrend()
  },
  updateTrend() {
    const { from, to } = this.data
    if (from > to) {
      this.setData({ error: '开始日期不能晚于结束日期' })
      return
    }
    const timeline = [
      ...this.data.events
        .filter(e => inRange(e.occurredAt, from, to))
        .map(e => ({ date: e.occurredAt, title: e.title, detail: e.detail })),
      ...this.data.temperatures
        .filter(t => inRange(t.measuredAt, from, to) && t.symptoms.length)
        .map(t => ({ date: t.measuredAt, title: t.symptoms.join('、'), detail: t.note })),
      ...this.data.medications
        .flatMap(m => [
          {
            date: m.startDate,
            title: m.name + ' 开始',
            detail: m.dose + m.unit + ' 每日' + m.frequency + '次'
          },
          ...(m.endDate ? [{ date: m.endDate, title: m.name + ' 停用', detail: '' }] : [])
        ])
        .filter(e => inRange(e.date, from, to))
    ].sort((a, b) => a.date.localeCompare(b.date))
    this.setData({ summary: report(this.data, from, to), timeline })
    if (this.data.tab === 'trend')
      wx.nextTick(() => {
        this.draw(
          'temperatureChart',
          this.data.temperatures
            .filter(t => inRange(t.measuredAt, from, to))
            .map(t => ({ date: t.measuredAt, value: t.value })),
          '℃'
        )
        const key = this.data.labKeys[this.data.labIndex]
        const labs = this.data.labs.filter(
          l => l.name + ' | ' + l.unit === key && inRange(l.testedAt, from, to)
        )
        this.draw(
          'labChart',
          labs.map(l => ({ date: l.testedAt, value: l.value })),
          labs[0]?.unit || ''
        )
      })
  },
  draw(id, points, unit) {
    const ctx = wx.createCanvasContext(id, this)
    const width = wx.getWindowInfo().windowWidth - 52,
      height = 220
    ctx.clearRect(0, 0, width, 240)
    ctx.setFillStyle('#74808d')
    if (!points.length) {
      ctx.fillText('所选范围暂无记录', 35, 100)
      ctx.draw()
      return
    }
    points.sort((a, b) => a.date.localeCompare(b.date))
    const min = Math.min(...points.map(p => p.value)) - 0.5,
      max = Math.max(...points.map(p => p.value)) + 0.5
    ctx.fillText(unit, 42, 15)
    for (let i = 0; i < 4; i++) {
      const y = 35 + i * 45
      ctx.setStrokeStyle('#e0e8f0')
      ctx.beginPath()
      ctx.moveTo(40, y)
      ctx.lineTo(width - 10, y)
      ctx.stroke()
      ctx.fillText((max - (i * (max - min)) / 3).toFixed(1), 0, y + 4)
    }
    const first = Date.parse(points[0].date),
      last = Date.parse(points[points.length - 1].date)
    ctx.setStrokeStyle('#2878e8')
    ctx.setLineWidth(2)
    ctx.beginPath()
    points.forEach((p, i) => {
      const x =
          40 +
          (last === first ? 0.5 : (Date.parse(p.date) - first) / (last - first)) * (width - 60),
        y = 170 - ((p.value - min) / (max - min)) * 135
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    })
    ctx.stroke()
    ctx.setFillStyle('#2878e8')
    points.forEach(p => {
      const x =
          40 +
          (last === first ? 0.5 : (Date.parse(p.date) - first) / (last - first)) * (width - 60),
        y = 170 - ((p.value - min) / (max - min)) * 135
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.setFillStyle('#74808d')
    ctx.fillText(points[0].date.slice(5, 10), 40, 205)
    ctx.fillText(points[points.length - 1].date.slice(5, 10), width - 55, 205)
    ctx.draw()
  },
  copyReport() {
    wx.setClipboardData({ data: this.data.summary })
  },
  async exportBackup() {
    await this.run(async () => {
      const b = await request('/export')
      const file = wx.env.USER_DATA_PATH + '/kangcheng-' + dayNow() + '.json'
      await new Promise((resolve, reject) =>
        wx
          .getFileSystemManager()
          .writeFile({
            filePath: file,
            data: JSON.stringify(b, null, 2),
            encoding: 'utf8',
            success: resolve,
            fail: reject
          })
      )
      if (wx.shareFileMessage)
        wx.shareFileMessage({ filePath: file, fileName: 'kangcheng-' + dayNow() + '.json' })
      else wx.setClipboardData({ data: JSON.stringify(b, null, 2) })
    })
  },
  importBackup() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: async r => {
        await this.run(async () => {
          const raw = wx.getFileSystemManager().readFileSync(r.tempFiles[0].path, 'utf8')
          const b = validateBackup(JSON.parse(raw))
          const confirmed = await new Promise(resolve =>
            wx.showModal({
              title: '恢复备份',
              content: '会覆盖所有现有记录，请先备份。确定恢复？',
              success: r => resolve(r.confirm)
            })
          )
          if (confirmed) await request('/import', 'POST', b)
        })
        if (!this.data.error) await this.reload()
      }
    })
  }
})
