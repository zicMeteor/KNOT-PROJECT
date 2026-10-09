// 빛나는 실 그래프: canvas 2D로 3D 회전을 흉내 낸다 (홈 배경용)
// 디자인 시안(빛의 실)의 엔진을 옮겨 왔다. 실제 지식 그래프 페이지는 react-force-graph-3d를 쓴다
import { categoryColor } from "../constants/categories"

function lc(s) {
  return String(s).toLowerCase()
}

// 태그 그래프: 노드 = 태그(색은 가장 많이 쓰인 카테고리), 엣지 = 함께 쓴 자료 수
export function tagGraph(items) {
  var map = {},
    links = {}
  items.forEach(function (it) {
    it.tags.forEach(function (t) {
      var n = map[lc(t)] || (map[lc(t)] = { id: lc(t), label: t, count: 0, cats: {}, items: [] })
      n.count++
      n.cats[it.cat] = (n.cats[it.cat] || 0) + 1
      n.items.push(it)
    })
    for (var i = 0; i < it.tags.length; i++)
      for (var j = i + 1; j < it.tags.length; j++) {
        var a = lc(it.tags[i]),
          b = lc(it.tags[j])
        if (a > b) {
          var t = a
          a = b
          b = t
        }
        var k = a + "|" + b
        ;(links[k] || (links[k] = { source: a, target: b, weight: 0, items: [] })).weight++
        links[k].items.push(it)
      }
  })
  var nodes = Object.keys(map).map(function (k) {
    var n = map[k],
      best = null,
      bn = -1
    Object.keys(n.cats).forEach(function (c) {
      if (n.cats[c] > bn) {
        bn = n.cats[c]
        best = c
      }
    })
    n.cat = best
    n.color = categoryColor(best)
    return n
  })
  return {
    nodes: nodes,
    links: Object.keys(links).map(function (k) {
      return links[k]
    }),
  }
}

export function reducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}

// 결정적인 난수 (매번 같은 배치가 나오게)
function rng(seed) {
  var s = seed || 7
  return function () {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// 3D 힘 배치를 미리 계산한다 (화면에서는 자리 잡는 움직임 대신 풀리는 연출만 보여준다)
function layout(nodes, links, seed) {
  var r = rng(seed),
    idx = {}
  nodes.forEach(function (n) {
    idx[n.id] = n
    if (n.x == null) {
      n.x = r() - 0.5
      n.y = r() - 0.5
      n.z = r() - 0.5
    }
    n.vx = n.vy = n.vz = 0
  })
  for (var step = 0; step < 260; step++) {
    for (var i = 0; i < nodes.length; i++)
      for (var j = i + 1; j < nodes.length; j++) {
        var a = nodes[i],
          b = nodes[j],
          dx = a.x - b.x,
          dy = a.y - b.y,
          dz = a.z - b.z
        var d2 = dx * dx + dy * dy + dz * dz + 0.001,
          f = 0.004 / d2
        a.vx += dx * f
        a.vy += dy * f
        a.vz += dz * f
        b.vx -= dx * f
        b.vy -= dy * f
        b.vz -= dz * f
      }
    links.forEach(function (l) {
      var a = idx[l.source],
        b = idx[l.target]
      if (!a || !b) return
      var dx = b.x - a.x,
        dy = b.y - a.y,
        dz = b.z - a.z,
        d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6
      var f = (d - 0.32) * 0.06
      dx /= d
      dy /= d
      dz /= d
      a.vx += dx * f
      a.vy += dy * f
      a.vz += dz * f
      b.vx -= dx * f
      b.vy -= dy * f
      b.vz -= dz * f
    })
    nodes.forEach(function (n) {
      n.vx -= n.x * 0.012
      n.vy -= n.y * 0.012
      n.vz -= n.z * 0.012
      n.x += n.vx
      n.y += n.vy
      n.z += n.vz
      n.vx *= 0.6
      n.vy *= 0.6
      n.vz *= 0.6
    })
  }
  var m = 0
  nodes.forEach(function (n) {
    m = Math.max(m, Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z))
  })
  nodes.forEach(function (n) {
    n.x /= m
    n.y /= m
    n.z /= m
  })
}

function hexA(hex, a) {
  var h = hex.replace("#", ""),
    r = parseInt(h.slice(0, 2), 16),
    g = parseInt(h.slice(2, 4), 16),
    b = parseInt(h.slice(4, 6), 16)
  return "rgba(" + r + "," + g + "," + b + "," + a + ")"
}
function easeOut(t) {
  return 1 - Math.pow(1 - t, 3)
}

/* 그래프 하나를 canvas에 붙인다
   opts: data {nodes, links}, scale(반지름 비율), speed(회전), labels('all'|'big'|'none'),
         interactive, onHover(node|link|null), onClick(node|link|null), dust(배경 먼지 수), seed */
export function create(canvas, opts) {
  opts = opts || {}
  var ctx = canvas.getContext("2d")
  var reduced = reducedMotion()
  var W = 0,
    H = 0,
    DPR = Math.min(window.devicePixelRatio || 1, 2)
  var nodes = [],
    links = [],
    idx = {}
  var angle = opts.angle || 0.5,
    tiltX = 0,
    tiltY = 0,
    mx = -9999,
    my = -9999,
    inside = false
  // 카메라: zoom(확대), f*(중심으로 잡을 점), k(1 = 다 풀림, 작을수록 매듭처럼 뭉침), catA(카테고리 이름 밝기)
  var cam = { zoom: 1, fx: 0, fy: 0, fz: 0, k: 1, catA: 0 },
    tgt = { zoom: 1, fx: 0, fy: 0, fz: 0, k: 1, catA: 0 }
  if (opts.view) {
    Object.assign(cam, opts.view)
    Object.assign(tgt, opts.view)
  }
  var born = 0,
    raf = 0,
    alive = true,
    last = 0
  var hi = null,
    sel = null,
    selLink = null,
    hover = null
  var dust = [],
    r = rng(opts.seed || 3)
  for (var i = 0; i < (opts.dust == null ? 70 : opts.dust); i++)
    dust.push({ x: r(), y: r(), z: r(), s: r() })

  function setData(d, keepPos) {
    var old = idx
    nodes = d.nodes.map(function (n) {
      var o = keepPos && old[n.id]
      var c = Object.assign({}, n)
      if (o) {
        c.x = o.x
        c.y = o.y
        c.z = o.z
        c.t0 = o.t0
      }
      return c
    })
    idx = {}
    nodes.forEach(function (n) {
      idx[n.id] = n
    })
    links = d.links
      .filter(function (l) {
        return idx[l.source] && idx[l.target]
      })
      .map(function (l) {
        return Object.assign({ off: 0, vel: 0, bend: 0 }, l)
      })
    layout(nodes, links, opts.seed || 11)
    if (!keepPos) born = performance.now()
  }

  function resize() {
    var rect = canvas.getBoundingClientRect()
    W = Math.max(1, rect.width)
    H = Math.max(1, rect.height)
    canvas.width = Math.round(W * DPR)
    canvas.height = Math.round(H * DPR)
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  }

  function proj(n, k) {
    var ca = Math.cos(angle),
      sa = Math.sin(angle),
      cb = Math.cos(tiltX),
      sb = Math.sin(tiltX)
    var x = (n.x - cam.fx) * k,
      y = (n.y - cam.fy) * k,
      z = (n.z - cam.fz) * k
    var x1 = x * ca + z * sa,
      z1 = -x * sa + z * ca
    var y1 = y * cb - z1 * sb,
      z2 = y * sb + z1 * cb
    var R = Math.min(W, H) * (opts.scale || 0.38) * cam.zoom,
      f = 2.6,
      s = f / (f + Math.max(-1.6, z2))
    return {
      x: W * (opts.cx || 0.5) + x1 * R * s + tiltY * 18,
      y: H * (opts.cy || 0.5) + y1 * R * s,
      s: s,
      z: z2,
    }
  }

  function nodeR(n) {
    return (opts.nodeSize || 3) + Math.sqrt(n.count || 1) * (opts.nodeGrow || 2.4)
  }

  function lit(n) {
    if (selLink) return n.id === selLink.source || n.id === selLink.target
    if (sel)
      return (
        n.id === sel ||
        links.some(function (l) {
          return (l.source === sel && l.target === n.id) || (l.target === sel && l.source === n.id)
        })
      )
    if (hi) return hi.has(n.id)
    return true
  }

  function curvePts(l, P) {
    var a = P[l.source],
      b = P[l.target]
    var mxp = (a.x + b.x) / 2,
      myp = (a.y + b.y) / 2,
      dx = b.x - a.x,
      dy = b.y - a.y,
      len = Math.sqrt(dx * dx + dy * dy) + 1e-6
    var nx = -dy / len,
      ny = dx / len,
      base = len * 0.12
    return {
      a: a,
      b: b,
      cx: mxp + nx * (base + l.off),
      cy: myp + ny * (base + l.off),
      nx: nx,
      ny: ny,
      mx: mxp,
      my: myp,
    }
  }

  function frame(t) {
    if (!alive) return
    var dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016
    last = t
    if (!canvas.isConnected) {
      alive = false
      return
    }
    var rect = canvas.getBoundingClientRect()
    if (Math.abs(rect.width - W) > 1 || Math.abs(rect.height - H) > 1) resize()
    if (!reduced && !(opts.pauseOnHover && hover))
      angle += dt * (opts.speed == null ? 0.105 : opts.speed)
    var tx = inside ? (my / H - 0.5) * 0.5 : 0,
      ty = inside ? mx / W - 0.5 : 0
    tiltX += (tx - tiltX) * 0.05
    tiltY += (ty - tiltY) * 0.05

    ;["zoom", "fx", "fy", "fz", "k", "catA"].forEach(function (key) {
      cam[key] = reduced ? tgt[key] : cam[key] + (tgt[key] - cam[key]) * 0.045
    })
    var age = reduced ? 1 : Math.min(1, (t - born) / 1700),
      kv = easeOut(age)
    ctx.clearRect(0, 0, W, H)

    // 배경 먼지: 깊이감
    ctx.globalCompositeOperation = "source-over"
    dust.forEach(function (d) {
      var x = ((d.x + angle * 0.02 * (0.3 + d.z)) % 1) * W,
        y = d.y * H
      ctx.fillStyle = "rgba(255,255,255," + (0.05 + d.s * 0.12) + ")"
      ctx.fillRect(x, y, 1 + d.z, 1 + d.z)
    })

    var P = {}
    nodes.forEach(function (n) {
      var nv = n.t0 != null ? easeOut(Math.min(1, (t - n.t0) / 1200)) : kv
      var p = proj(n, nv * cam.k)
      P[n.id] = p
      n._p = p
      n._k = nv
    })

    // 실: 커서 근처를 지나가면 커서 쪽으로 당겨졌다가 튕기며 돌아간다
    ctx.globalCompositeOperation = "lighter"
    links.forEach(function (l) {
      var c = curvePts(l, P),
        pull = 0
      if (inside && !reduced) {
        var dx = mx - c.mx,
          dy = my - c.my,
          d = Math.sqrt(dx * dx + dy * dy)
        if (d < 110) pull = (dx * c.nx + dy * c.ny) * (1 - d / 110) * 0.9
      }
      l.vel += (pull - l.off) * 0.18
      l.vel *= 0.82
      l.off += l.vel
      c = curvePts(l, P)
      var A = idx[l.source],
        B = idx[l.target]
      var on = lit(A) && lit(B),
        strong = selLink === l || hover === l
      var depth = Math.max(0.25, Math.min(1, (c.a.s + c.b.s) / 2 - 0.45))
      var alpha = (on ? (hi || sel || selLink ? 0.75 : 0.42) : 0.06) * depth * kv
      var g = ctx.createLinearGradient(c.a.x, c.a.y, c.b.x, c.b.y)
      g.addColorStop(0, hexA(A.color, alpha))
      g.addColorStop(1, hexA(B.color, alpha))
      ctx.strokeStyle = g
      ctx.lineWidth = strong ? 2.6 : 0.6 + Math.min(2, (l.weight || 1) * 0.45)
      ctx.beginPath()
      ctx.moveTo(c.a.x, c.a.y)
      ctx.quadraticCurveTo(c.cx, c.cy, c.b.x, c.b.y)
      ctx.stroke()
      if (strong || (on && (sel || selLink))) {
        ctx.lineWidth = 6
        ctx.strokeStyle = "rgba(255,255,255," + 0.06 * kv + ")"
        ctx.stroke()
      }
      l._c = c
    })

    // 노드: 빛 번짐 + 중심
    var order = nodes.slice().sort(function (a, b) {
      return b._p.z - a._p.z
    })
    order.forEach(function (n) {
      var p = n._p,
        on = lit(n),
        rr = nodeR(n) * p.s * (0.4 + 0.6 * n._k)
      var near = inside ? Math.max(0, 1 - Math.hypot(mx - p.x, my - p.y) / 140) : 0
      var pl = n.pulse ? Math.max(0, 1 - (t - n.pulse) / 900) : 0
      var boost = hover === n || sel === n.id ? 1 : Math.max(near * 0.6, pl * 1.6)
      var a = (on ? 1 : 0.14) * n._k
      var halo = rr * (4.2 + boost * 2.5)
      var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, halo)
      g.addColorStop(0, hexA(n.color, 0.55 * a))
      g.addColorStop(0.35, hexA(n.color, 0.16 * a))
      g.addColorStop(1, hexA(n.color, 0))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(p.x, p.y, halo, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = hexA(n.color, Math.min(1, 0.9 * a + boost * 0.1))
      ctx.beginPath()
      ctx.arc(p.x, p.y, rr, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = "rgba(255,255,255," + 0.85 * a + ")"
      ctx.beginPath()
      ctx.arc(p.x, p.y, Math.max(0.8, rr * 0.38), 0, Math.PI * 2)
      ctx.fill()
    })

    // 이름
    ctx.globalCompositeOperation = "source-over"
    var lab = opts.labels || "big"
    if (lab !== "none" && cam.k >= 0.5) {
      // 이름 우선순위: 선택·마우스 > 선택의 이웃·강조 > 자료가 많은 태그. 겹치는 이름은 뒤 순위를 뺀다
      var nb = {}
      if (sel)
        links.forEach(function (l) {
          if (l.source === sel) nb[l.target] = 1
          if (l.target === sel) nb[l.source] = 1
        })
      var focusing2 = !!(sel || selLink || hi)
      var cand = []
      order.forEach(function (n) {
        if (n._k < 0.6) return
        var pr
        if (
          hover === n ||
          sel === n.id ||
          (selLink && (selLink.source === n.id || selLink.target === n.id))
        )
          pr = 0
        else if (nb[n.id] || (hi && hi.has(n.id))) pr = 1
        else if (focusing2) return
        else if (lab === "all" || (n.count || 1) >= (opts.labelMin || 2)) pr = 2
        else return
        cand.push({ n: n, pr: pr })
      })
      cand.sort(function (a, b) {
        return a.pr - b.pr || (b.n.count || 1) - (a.n.count || 1)
      })
      var limit = opts.labelMax || 12,
        placed = [],
        shown = 0
      ctx.textBaseline = "middle"
      ctx.lineJoin = "round"
      cand.forEach(function (c) {
        var n = c.n,
          p = n._p
        if (c.pr === 2 && shown >= limit) return
        var size = Math.round(
          (opts.fontSize || 12) * Math.min(1.15, Math.max(0.9, p.s)) * (c.pr === 0 ? 1.15 : 1),
        )
        ctx.font =
          (c.pr === 0 ? "600 " : "500 ") +
          size +
          'px "Noto Sans KR", Pretendard, system-ui, sans-serif'
        var x = p.x + nodeR(n) * p.s + 7,
          w = ctx.measureText(n.label).width
        var box = { l: x - 3, r: x + w + 3, t: p.y - size / 2 - 3, b: p.y + size / 2 + 3 }
        var hit = placed.some(function (q) {
          return box.l < q.r && box.r > q.l && box.t < q.b && box.b > q.t
        })
        if (hit && c.pr > 0) return
        placed.push(box)
        shown++
        var a =
          (c.pr === 2 ? 0.86 : 1) *
          Math.max(0.55, Math.min(1, p.s - 0.15)) *
          Math.min(1, (n._k - 0.6) / 0.4) *
          Math.min(1, (cam.k - 0.5) / 0.3)
        // 빛 위에서도 읽히게 글자에 어두운 테두리
        ctx.lineWidth = 4
        ctx.strokeStyle = "rgba(0,0,0," + 0.85 * a + ")"
        ctx.strokeText(n.label, x, p.y)
        ctx.fillStyle = "rgba(242,242,240," + a + ")"
        ctx.fillText(n.label, x, p.y)
      })
    }

    // 카테고리 이름: 같은 색 무리의 가운데에 띄운다
    if (cam.catA > 0.02) {
      // 각 카테고리에서 가장 큰 태그 위에 이름을 단다 (무리의 평균 위치는 빈 공간에 뜨기 쉽다)
      var best = {}
      nodes.forEach(function (n) {
        if (!n.cat) return
        if (!best[n.cat] || (n.count || 1) > (best[n.cat].count || 1)) best[n.cat] = n
      })
      ctx.textAlign = "center"
      ctx.font =
        "400 " + (opts.catFont || 22) + 'px "Noto Serif KR", "Nanum Myeongjo", Georgia, serif'
      var catPlaced = []
      Object.keys(best).forEach(function (c) {
        var n = best[c],
          p = n._p,
          x = p.x,
          y = p.y - nodeR(n) * p.s - 24
        // 이름끼리 겹치면 위로 비켜 놓는다
        for (var tries = 0; tries < 4; tries++) {
          var hit = catPlaced.some(function (q) {
            return Math.abs(q.x - x) < 70 && Math.abs(q.y - y) < 26
          })
          if (!hit) break
          y -= 28
        }
        catPlaced.push({ x: x, y: y })
        ctx.fillStyle = hexA(categoryColor(c), 0.95 * cam.catA)
        ctx.fillText(c, x, y)
      })
      ctx.textAlign = "start"
    }
    if (opts.onFrame) opts.onFrame(P)
    raf = requestAnimationFrame(frame)
  }

  function pick(x, y) {
    var best = null,
      bd = 1e9
    nodes.forEach(function (n) {
      if (!n._p) return
      var d = Math.hypot(x - n._p.x, y - n._p.y)
      if (d < Math.max(16, nodeR(n) * n._p.s + 14) && d < bd) {
        bd = d
        best = n
      }
    })
    if (best) return best
    if (!opts.linkPick) return null
    var bl = null,
      bld = 13
    links.forEach(function (l) {
      var c = l._c
      if (!c) return
      for (var s = 0; s <= 12; s++) {
        var u = s / 12,
          px = (1 - u) * (1 - u) * c.a.x + 2 * (1 - u) * u * c.cx + u * u * c.b.x,
          py = (1 - u) * (1 - u) * c.a.y + 2 * (1 - u) * u * c.cy + u * u * c.b.y
        var d = Math.hypot(x - px, y - py)
        if (d < bld) {
          bld = d
          bl = l
        }
      }
    })
    return bl
  }

  function local(e) {
    var rc = canvas.getBoundingClientRect()
    return { x: e.clientX - rc.left, y: e.clientY - rc.top }
  }
  function onMove(e) {
    var p = local(e)
    mx = p.x
    my = p.y
    inside = true
    if (opts.interactive) {
      var h = pick(mx, my)
      if (h !== hover) {
        hover = h
        canvas.style.cursor = h ? "pointer" : ""
        if (opts.onHover) opts.onHover(h, mx, my)
      } else if (h && opts.onHover) opts.onHover(h, mx, my)
    }
  }
  function onLeave() {
    inside = false
    mx = my = -9999
    if (hover) {
      hover = null
      canvas.style.cursor = ""
      if (opts.onHover) opts.onHover(null)
    }
  }
  function onClick(e) {
    if (!opts.interactive) return
    var p = local(e)
    if (opts.onClick) opts.onClick(pick(p.x, p.y))
  }
  canvas.addEventListener("pointermove", onMove)
  canvas.addEventListener("pointerleave", onLeave)
  canvas.addEventListener("click", onClick)

  resize()
  setData(opts.data || { nodes: [], links: [] })
  raf = requestAnimationFrame(frame)

  return {
    setData: function (d, keep) {
      setData(d, keep)
    },
    setHighlight: function (set) {
      hi = set && set.size ? set : null
    },
    select: function (id) {
      sel = id
      selLink = null
    },
    selectLink: function (l) {
      selLink = l
        ? links.filter(function (x) {
            return x.source === l.source && x.target === l.target
          })[0] || null
        : null
      sel = null
    },
    // 새 노드가 생겨나는 연출: 이미 있는 노드는 그대로 두고 새 노드만 0에서 자란다
    grow: function (d) {
      var have = {}
      nodes.forEach(function (n) {
        have[n.id] = 1
      })
      setData(d, true)
      var now = performance.now()
      nodes.forEach(function (n) {
        if (!have[n.id]) n.t0 = now
      })
    },
    pluckAll: function (amt) {
      links.forEach(function (l) {
        l.vel += (amt || 14) * (Math.random() - 0.5)
      })
    },
    replay: function () {
      born = performance.now()
    },
    option: function (k, v) {
      opts[k] = v
    },
    // 노드의 지금 화면 위치 (canvas 기준 px). 없으면 null
    screenPos: function (id) {
      var n = idx[id]
      return n && n._p ? { x: n._p.x, y: n._p.y } : null
    },
    pulse: function (id) {
      var n = idx[id]
      if (n) n.pulse = performance.now()
    },
    // 카메라 이동: { zoom, k, catA, focus: 노드 id 또는 null }
    view: function (v) {
      if (v.focus !== undefined) {
        var n = v.focus && idx[v.focus]
        tgt.fx = n ? n.x : 0
        tgt.fy = n ? n.y : 0
        tgt.fz = n ? n.z : 0
      }
      ;["zoom", "k", "catA"].forEach(function (key) {
        if (v[key] != null) tgt[key] = v[key]
      })
    },
    destroy: function () {
      alive = false
      cancelAnimationFrame(raf)
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerleave", onLeave)
      canvas.removeEventListener("click", onClick)
    },
  }
}
