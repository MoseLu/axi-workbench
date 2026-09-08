import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import './LegalDocument.css';

const useIsomorphicLayoutEffect = typeof window === 'undefined'
  ? React.useEffect
  : React.useLayoutEffect;

type LegalDocumentProps = {
  kind: 'terms' | 'privacy';
};

const LegalDocument: React.FC<LegalDocumentProps> = ({ kind }) => {
  const { t } = useI18n();
  const isTerms = kind === 'terms';
  useIsomorphicLayoutEffect(() => {
    document.documentElement.classList.add('axi-legal-route');
    document.body.classList.add('axi-legal-route');

    return () => {
      document.documentElement.classList.remove('axi-legal-route');
      document.body.classList.remove('axi-legal-route');
    };
  }, []);

  const sections = isTerms
    ? [
      ['service', '一、服务内容'],
      ['security', '二、账号与安全'],
      ['acceptable-use', '三、合理使用'],
      ['changes', '四、服务变更'],
    ]
    : [
      ['collection', '一、我们处理的信息'],
      ['usage', '二、信息用途'],
      ['security', '三、信息安全'],
      ['rights', '四、你的权利'],
    ];

  return (
    <main className="axi-legal-page">
      <div className="axi-legal-layout">
        <aside className="axi-legal-sidebar" aria-label="文档目录">
          <Link className="axi-legal-brand" to="/login" aria-label={t("legal.brand.name")}>
            <img src="/favicon.svg" alt="" aria-hidden="true" />
            <span>{t("legal.brand.name")}</span>
          </Link>
          <div className="axi-legal-sidebar__title">法律文档</div>
          <Link className={isTerms ? 'is-active' : ''} to="/legal/terms">服务条款</Link>
          <Link className={!isTerms ? 'is-active' : ''} to="/legal/privacy">隐私政策</Link>
        </aside>

        <article className="axi-legal-document">
          <h1>{isTerms ? t("legal.terms.title") : t("legal.privacy.title")}</h1>
          <p className="axi-legal-meta">{t("legal.document.updated")}</p>
          {isTerms ? (
            <>
              <p>{t("legal.terms.welcome")}</p>
              <h2 id="service">一、服务内容</h2>
              <p>{t("legal.terms.serviceContent")}</p>
              <h2 id="security">二、账号与安全</h2>
              <p>你应使用真实、合法且由你控制的邮箱完成登录，并妥善保管验证码、密码和会话信息。</p>
              <h2 id="acceptable-use">三、合理使用</h2>
              <p>不得利用本产品从事违法活动、攻击系统、绕过访问控制、侵犯他人权益或干扰其他用户正常使用的行为。</p>
              <h2 id="changes">四、服务变更</h2>
              <p>我们可能根据产品演进、维护和安全需要调整服务内容，并通过适当方式进行说明。</p>
            </>
          ) : (
            <>
              <p>{t("legal.privacy.intro")}</p>
              <h2 id="collection">一、我们处理的信息</h2>
              <p>我们可能处理你主动提交的邮箱、登录凭证、会话信息、设备配对信息以及必要的运行日志。</p>
              <h2 id="usage">二、信息用途</h2>
              <p>相关信息用于建立和维护账号会话、提供工作台功能、保障系统安全、处理故障和改进服务。</p>
              <h2 id="security">三、信息安全</h2>
              <p>我们采取访问控制、传输保护和最小化存储等措施保护信息。请不要向任何人泄露验证码或密码。</p>
              <h2 id="rights">四、你的权利</h2>
              <p>在适用法律允许的范围内，你可以通过产品支持渠道咨询、更正或删除与账号相关的信息。</p>
            </>
          )}
        </article>

        <aside className="axi-legal-toc" aria-label="本页导航">
          <div className="axi-legal-toc__title">本页导航</div>
          {sections.map(([id, title]) => <a key={id} href={`#${id}`}>{title}</a>)}
        </aside>
      </div>
    </main>
  );
};

export default LegalDocument;
