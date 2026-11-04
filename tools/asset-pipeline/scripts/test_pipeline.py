"""Test della pipeline Blender: esecuzione reale di bpy, determinismo, varianti, validatore.

    python tools/asset-pipeline/scripts/test_pipeline.py      (richiede il modulo bpy o Blender)
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
PIPE = os.path.join(ROOT, 'tools', 'asset-pipeline')
ok_all = True


def check(name, cond, info=''):
    global ok_all
    print(('OK   ' if cond else 'FALLITO ') + name + (' — ' + str(info) if info else ''))
    ok_all = ok_all and bool(cond)


def run_build(out, specs_path=None, ids=()):
    env = dict(os.environ, PIPE_OUT=out, PIPE_REP=os.path.join(out, 'rapporti'))
    if specs_path:
        env['PIPE_SPECS'] = specs_path
    r = subprocess.run([sys.executable, os.path.join(HERE, 'build.py'), *ids], env=env, capture_output=True, text=True)
    return r


def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()


tmp = tempfile.mkdtemp(prefix='omaha_pipe_')
try:
    a, b = os.path.join(tmp, 'a'), os.path.join(tmp, 'b')
    ra = run_build(a, ids=['normandy_house_01'])
    check('Blender (bpy) esegue generatore, esportazione e validazione', ra.returncode == 0, (ra.stdout.strip().splitlines() or ['?'])[-1][:120] if ra.returncode == 0 else ra.stderr[-400:])
    rb = run_build(b, ids=['normandy_house_01'])
    ga, gb = os.path.join(a, 'normandy_house_01.glb'), os.path.join(b, 'normandy_house_01.glb')
    check('GLB generato', os.path.exists(ga), '%.0f KB' % (os.path.getsize(ga) / 1024) if os.path.exists(ga) else '')
    ma = json.load(open(os.path.join(a, 'normandy_house_01.json')))
    mb = json.load(open(os.path.join(b, 'normandy_house_01.json')))
    # il GLB contiene il nome del generatore e la versione; la geometria deve coincidere bit per bit
    check('determinismo: stesso seme e parametri => stesso GLB', os.path.exists(gb) and sha(ga) == sha(gb), sha(ga)[:12])
    check('determinismo: stesse collisioni e pavimenti', ma['collisioni'] == mb['collisioni'] and ma['pavimenti'] == mb['pavimenti'], '%d collisioni' % len(ma['collisioni']))
    # variante: altro seme e parametri diversi
    specs = json.load(open(os.path.join(PIPE, 'manifests', 'assets.json')))
    var = dict(specs['normandy_house_01'])
    var['seed'] = 7
    var['params'] = dict(var['params'], width=10.4, front_windows=2, door_slot=0, wear=0.9, chimneys='left', shutters_open=0.5)
    sp = os.path.join(tmp, 'specs.json')
    json.dump({'variante_test': var}, open(sp, 'w'))
    c = os.path.join(tmp, 'c')
    rc = run_build(c, sp, ['variante_test'])
    gc = os.path.join(c, 'variante_test.glb')
    check('variante (seme 7, 10.4 m, 2 finestre, usura 0.9, un comignolo) generata e valida', rc.returncode == 0 and os.path.exists(gc), (rc.stdout.strip().splitlines() or ['?'])[-1][:120] if rc.returncode == 0 else rc.stderr[-300:])
    if os.path.exists(gc):
        mc = json.load(open(os.path.join(c, 'variante_test.json')))
        check('la variante è diversa dalla casa base', sha(gc) != sha(ga) and abs(mc['dimensioni']['larghezza'] - 10.4) < 1e-6, 'LOD0 %d tri contro %d' % (mc['lod']['LOD0']['triangoli'], ma['lod']['LOD0']['triangoli']))
        rv = json.load(open(os.path.join(c, 'variante_test.json')))
        check('variante: collisioni dentro l\'ingombro', len(rv['collisioni']) > 20)
    # il validatore deve accorgersi dei file rotti
    sys.path.insert(0, os.path.join(PIPE, 'blender', 'validators'))
    import validate_glb
    broken = os.path.join(tmp, 'rotto.glb')
    data = bytearray(open(ga, 'rb').read())
    open(broken, 'wb').write(bytes(data[:len(data) // 2]))
    r = validate_glb.validate(broken)
    check('validatore: GLB troncato segnalato come errore', r['errori'], r['errori'][:1])
    r = validate_glb.validate(os.path.join(tmp, 'nessuno.glb'))
    check('validatore: file inesistente segnalato', r['errori'], r['errori'][:1])
    lib = json.load(open(os.path.join(PIPE, 'manifests', 'materials.json')))
    lib2 = {k: v for k, v in lib.items() if k != 'slate'}
    r = validate_glb.validate(ga, ma, lib2)
    check('validatore: materiale sconosciuto al runtime segnalato', any('slate' in e for e in r['errori']))
    r = validate_glb.validate(ga, ma, lib, {'lod0_tri': 1000, 'kb': 10})
    check('validatore: budget superato = avviso (non errore)', r['avvisi'] and not r['errori'], r['avvisi'][:2])
    # il file nel repository corrisponde a quanto genera la pipeline adesso
    repo = os.path.join(ROOT, 'assets', 'aaa', 'pipeline', 'normandy_house_01.glb')
    check('GLB nel repository aggiornato rispetto ai sorgenti', os.path.exists(repo) and sha(repo) == sha(ga))
finally:
    shutil.rmtree(tmp, ignore_errors=True)
print('\nesito:', 'tutti superati' if ok_all else 'CI SONO FALLIMENTI')
sys.exit(0 if ok_all else 1)
