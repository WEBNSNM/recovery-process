const base = () => getApp().globalData.apiBase
function request(path, method = 'GET', data) {
  return new Promise((resolve, reject) =>
    wx.request({
      url: base() + '/api' + path,
      method,
      data,
      header: {
        'content-type': 'application/json',
        'x-data-key': wx.getStorageSync('kangcheng-access-key') || ''
      },
      success: r =>
        r.statusCode >= 200 && r.statusCode < 300
          ? resolve(r.data)
          : reject(Error(r.data.error || '接口请求失败')),
      fail: () => reject(Error('无法连接接口，请检查 apiBase 和 Worker'))
    })
  )
}
module.exports = { request }
