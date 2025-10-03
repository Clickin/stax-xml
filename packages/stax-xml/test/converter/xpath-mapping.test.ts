import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/index.js';

describe('XPath Mapping Tests', () => {
  describe('Cross-Section Mapping', () => {
    it('should map from different XML sections to single object', () => {
      const xml = `
        <document>
          <header>
            <title>My Document</title>
            <created>2024-01-01</created>
          </header>
          <metadata>
            <author>John Doe</author>
            <tags>
              <tag>important</tag>
              <tag>draft</tag>
            </tags>
          </metadata>
          <content>
            <section id="intro">
              <title>Introduction</title>
              <wordCount>250</wordCount>
            </section>
            <section id="main">
              <title>Main Content</title>
              <wordCount>1500</wordCount>
            </section>
          </content>
          <footer>
            <lastModified>2024-01-15</lastModified>
            <version>1.2</version>
          </footer>
        </document>
      `;

      const schema = x.object({
        // From header
        title: x.string().xpath('/document/header/title'),
        created: x.string().xpath('/document/header/created'),
        // From metadata
        author: x.string().xpath('/document/metadata/author'),
        tags: x.array(x.string(), '/document/metadata/tags/tag'),
        // From content
        totalWords: x.array(x.number(), '/document/content/section/wordCount')
          .transform(counts => counts.reduce((sum, count) => sum + count, 0)),
        sectionTitles: x.array(x.string(), '/document/content/section/title'),
        // From footer
        lastModified: x.string().xpath('/document/footer/lastModified'),
        version: x.string().xpath('/document/footer/version')
      });

      const result = schema.parseSync(xml);

      expect(result.title).toBe('My Document');
      expect(result.author).toBe('John Doe');
      expect(result.tags).toEqual(['important', 'draft']);
      expect(result.totalWords).toBe(1750);
      expect(result.sectionTitles).toEqual(['Introduction', 'Main Content']);
      expect(result.version).toBe('1.2');
    });

    it('should combine data from scattered locations', () => {
      const xml = `
        <application>
          <config>
            <database>
              <host>localhost</host>
              <port>5432</port>
            </database>
            <cache>
              <ttl>3600</ttl>
            </cache>
          </config>
          <runtime>
            <memory>
              <used>512</used>
              <total>1024</total>
            </memory>
            <connections>
              <active>15</active>
              <max>100</max>
            </connections>
          </runtime>
          <logs>
            <error>
              <count>3</count>
              <lastError>Connection timeout</lastError>
            </error>
            <warning>
              <count>12</count>
            </warning>
          </logs>
        </application>
      `;

      const schema = x.object({
        // System configuration
        dbHost: x.string().xpath('//config/database/host'),
        dbPort: x.number().xpath('//config/database/port').int(),
        cacheTtl: x.number().xpath('//config/cache/ttl').int(),
        // Runtime metrics
        memoryUsage: x.number().xpath('//runtime/memory/used').int(),
        memoryTotal: x.number().xpath('//runtime/memory/total').int(),
        activeConnections: x.number().xpath('//runtime/connections/active').int(),
        maxConnections: x.number().xpath('//runtime/connections/max').int(),
        // Error tracking
        errorCount: x.number().xpath('//logs/error/count').int(),
        warningCount: x.number().xpath('//logs/warning/count').int(),
        lastError: x.string().xpath('//logs/error/lastError')
      }).transform(data => ({
        database: {
          host: data.dbHost,
          port: data.dbPort
        },
        memory: {
          used: data.memoryUsage,
          total: data.memoryTotal,
          percentage: Math.round((data.memoryUsage / data.memoryTotal) * 100)
        },
        connections: {
          active: data.activeConnections,
          max: data.maxConnections,
          percentage: Math.round((data.activeConnections / data.maxConnections) * 100)
        },
        health: {
          errors: data.errorCount,
          warnings: data.warningCount,
          lastError: data.lastError,
          status: data.errorCount === 0 ? 'healthy' : 'degraded'
        },
        cacheTtl: data.cacheTtl
      }));

      const result = schema.parseSync(xml);

      expect(result.database).toEqual({ host: 'localhost', port: 5432 });
      expect(result.memory.percentage).toBe(50);
      expect(result.connections.percentage).toBe(15);
      expect(result.health.status).toBe('degraded');
    });
  });

  describe('Simple XPath Expressions', () => {
    it('should use basic predicates', () => {
      const xml = `
        <catalog>
          <products>
            <product id="1" category="electronics" price="999.99" stock="5">
              <name>Laptop</name>
            </product>
            <product id="2" category="electronics" price="299.99" stock="0">
              <name>Phone</name>
            </product>
            <product id="3" category="books" price="29.99" stock="15">
              <name>Guide to XML</name>
            </product>
          </products>
        </catalog>
      `;

      const schema = x.object({
        // Products with specific conditions using simple attribute predicates
        firstProduct: x.string().xpath("//product[@id='1']/name"),
        electronicsProducts: x.array(x.string(), "//product[@category='electronics']/name"),
        booksProducts: x.array(x.string(), "//product[@category='books']/name"),
        // Position predicates
        firstProductName: x.string().xpath('//product[1]/name'),
        secondProductName: x.string().xpath('//product[2]/name'),
        // All prices and names
        allNames: x.array(x.string(), '//product/name'),
        allPrices: x.array(x.number(), '//product/@price')
      });

      const result = schema.parseSync(xml);

      expect(result.firstProduct).toBe('Laptop');
      expect(result.electronicsProducts).toEqual(['Laptop', 'Phone']);
      expect(result.booksProducts).toEqual(['Guide to XML']);
      expect(result.firstProductName).toBe('Laptop');
      expect(result.secondProductName).toBe('Phone');
      expect(result.allNames).toEqual(['Laptop', 'Phone', 'Guide to XML']);
      expect(result.allPrices).toEqual([999.99, 299.99, 29.99]);
    });

    it('should handle path expressions with multiple levels', () => {
      const xml = `
        <library>
          <section name="Fiction">
            <shelf id="A1">
              <book id="book1">
                <title>Novel 1</title>
                <author>Author A</author>
              </book>
              <book id="book2">
                <title>Novel 2</title>
                <author>Author A</author>
              </book>
            </shelf>
            <shelf id="A2">
              <book id="book3">
                <title>Novel 3</title>
                <author>Author B</author>
              </book>
            </shelf>
          </section>
          <section name="Non-Fiction">
            <shelf id="B1">
              <book id="book4">
                <title>History Book</title>
                <author>Author C</author>
              </book>
            </shelf>
          </section>
        </library>
      `;

      const schema = x.object({
        // Using descendant axis
        allBookTitles: x.array(x.string(), '//book/title/text()'),
        allAuthors: x.array(x.string(), '//author/text()').transform(authors => [...new Set(authors)]),
        // Section-specific queries
        fictionBooks: x.array(x.string(), "//section[@name='Fiction']/shelf/book/title/text()"),
        nonFictionBooks: x.array(x.string(), "//section[@name='Non-Fiction']/shelf/book/title/text()"),
        // Shelf-specific queries
        shelfA1Books: x.array(x.string(), "//shelf[@id='A1']/book/title/text()"),
        // Complex path traversal
        shelfInfo: x.array(
          x.object({
            shelf: x.string().xpath('./@id'),
            bookCount: x.array(x.string(), './book/@id').transform(books => books.length)
          }),
          '//shelf'
        )
      });

      const result = schema.parseSync(xml);

      expect(result.allBookTitles).toEqual(['Novel 1', 'Novel 2', 'Novel 3', 'History Book']);
      expect(result.allAuthors).toEqual(['Author A', 'Author B', 'Author C']);
      expect(result.fictionBooks).toEqual(['Novel 1', 'Novel 2', 'Novel 3']);
      expect(result.nonFictionBooks).toEqual(['History Book']);
      expect(result.shelfA1Books).toEqual(['Novel 1', 'Novel 2']);
      expect(result.shelfInfo[0].bookCount).toBe(2);
    });
  });

  describe('Attribute and Text Combinations', () => {
    it('should combine attributes and text content', () => {
      const xml = `
        <inventory>
          <item sku="ABC123" category="electronics">
            <name lang="en">Smartphone</name>
            <price currency="USD">599.99</price>
            <description lang="en">Latest model smartphone</description>
            <availability status="in-stock" quantity="25"/>
          </item>
          <item sku="DEF456" category="books">
            <name lang="en">Programming Guide</name>
            <price currency="USD">49.99</price>
            <description lang="en">Comprehensive programming guide</description>
            <availability status="limited" quantity="3"/>
          </item>
          <item sku="GHI789" category="electronics">
            <name lang="en">Tablet</name>
            <price currency="EUR">399.99</price>
            <description lang="en">High-resolution tablet</description>
            <availability status="out-of-stock" quantity="0"/>
          </item>
        </inventory>
      `;

      const itemSchema = x.object({
        sku: x.string().xpath('./@sku'),
        category: x.string().xpath('./@category'),
        name: x.string().xpath('./name'),
        nameLanguage: x.string().xpath('./name/@lang'),
        price: x.number().xpath('./price'),
        priceCurrency: x.string().xpath('./price/@currency'),
        description: x.string().xpath('./description'),
        availabilityStatus: x.string().xpath('./availability/@status'),
        quantity: x.number().xpath('./availability/@quantity').int()
      }).transform(item => ({
        ...item,
        isAvailable: item.quantity > 0,
        priceInfo: `${item.price} ${item.priceCurrency}`,
        localizedName: `${item.name} (${item.nameLanguage})`
      }));

      const schema = x.object({
        items: x.array(itemSchema, '//item'),
        totalValue: x.array(
          x.object({
            price: x.number().xpath('./price'),
            quantity: x.number().xpath('./availability/@quantity').int()
          }),
          '//item'
        ).transform(items =>
          items.reduce((total, item) => total + (item.price * item.quantity), 0)
        ),
        categorySummary: x.array(x.string(), '//item/@category').transform(categories => {
          const summary = categories.reduce((acc, category) => {
            acc[category] = (acc[category] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          return summary;
        })
      });

      const result = schema.parseSync(xml);

      expect(result.items).toHaveLength(3);
      expect(result.items[0].priceInfo).toBe('599.99 USD');
      expect(result.items[0].localizedName).toBe('Smartphone (en)');
      expect(result.items[2].isAvailable).toBe(false);
      expect(result.categorySummary.electronics).toBe(2);
      expect(result.categorySummary.books).toBe(1);
    });

    it('should handle mixed attribute and text selections', () => {
      const xml = `
        <configuration>
          <database>
            <connection name="primary" timeout="30">
              <host>db1.example.com</host>
              <port>5432</port>
              <options ssl="true" poolSize="10">
                <retries>3</retries>
                <backoff>exponential</backoff>
              </options>
            </connection>
            <connection name="secondary" timeout="15">
              <host>db2.example.com</host>
              <port>5433</port>
              <options ssl="false" poolSize="5">
                <retries>2</retries>
                <backoff>linear</backoff>
              </options>
            </connection>
          </database>
          <cache>
            <redis enabled="true" ttl="3600">
              <host>cache.example.com</host>
              <port>6379</port>
            </redis>
          </cache>
        </configuration>
      `;

      const schema = x.object({
        primaryDb: x.object({
          name: x.string().xpath("//connection[@name='primary']/@name"),
          host: x.string().xpath("//connection[@name='primary']/host"),
          port: x.number().xpath("//connection[@name='primary']/port").int(),
          timeout: x.number().xpath("//connection[@name='primary']/@timeout").int(),
          ssl: x.string().xpath("//connection[@name='primary']/options/@ssl"),
          poolSize: x.number().xpath("//connection[@name='primary']/options/@poolSize").int(),
          retries: x.number().xpath("//connection[@name='primary']/options/retries").int()
        }),
        secondaryDb: x.object({
          name: x.string().xpath("//connection[@name='secondary']/@name"),
          host: x.string().xpath("//connection[@name='secondary']/host"),
          port: x.number().xpath("//connection[@name='secondary']/port").int(),
          ssl: x.string().xpath("//connection[@name='secondary']/options/@ssl"),
          backoff: x.string().xpath("//connection[@name='secondary']/options/backoff")
        }),
        cache: x.object({
          enabled: x.string().xpath('//redis/@enabled'),
          host: x.string().xpath('//redis/host'),
          port: x.number().xpath('//redis/port').int(),
          ttl: x.number().xpath('//redis/@ttl').int()
        }),
        allHosts: x.array(x.string(), '//host'),
        allPorts: x.array(x.number(), '//port'),
        connectionNames: x.array(x.string(), '//connection/@name')
      });

      const result = schema.parseSync(xml);

      expect(result.primaryDb.name).toBe('primary');
      expect(result.primaryDb.ssl).toBe('true');
      expect(result.primaryDb.poolSize).toBe(10);
      expect(result.secondaryDb.backoff).toBe('linear');
      expect(result.cache.enabled).toBe('true');
      expect(result.allHosts).toEqual(['db1.example.com', 'db2.example.com', 'cache.example.com']);
      expect(result.connectionNames).toEqual(['primary', 'secondary']);
    });
  });

  describe('Cross-Reference Mapping', () => {
    it('should resolve references between elements', () => {
      const xml = `
        <document>
          <definitions>
            <term id="xml">eXtensible Markup Language</term>
            <term id="json">JavaScript Object Notation</term>
            <term id="api">Application Programming Interface</term>
          </definitions>
          <content>
            <paragraph>
              Working with XML and JSON is common when building an API.
            </paragraph>
            <paragraph>
              The XML format is verbose but self-documenting.
            </paragraph>
          </content>
          <references>
            <ref term="xml" page="1"/>
            <ref term="json" page="5"/>
            <ref term="api" page="10"/>
          </references>
        </document>
      `;

      const schema = x.object({
        definitions: x.array(
          x.object({
            id: x.string().xpath('./@id'),
            definition: x.string().xpath('./text()')
          }),
          '//definitions/term'
        ).transform(terms =>
          terms.reduce((acc, term) => {
            acc[term.id] = term.definition;
            return acc;
          }, {} as Record<string, string>)
        ),
        referencePages: x.array(
          x.object({
            term: x.string().xpath('./@term'),
            page: x.number().xpath('./@page').int()
          }),
          '//references/ref'
        ).transform(refs =>
          refs.reduce((acc, ref) => {
            acc[ref.term] = ref.page;
            return acc;
          }, {} as Record<string, number>)
        ),
        paragraphs: x.array(x.string(), '//content/paragraph')
      });

      const result = schema.parseSync(xml);

      expect(result.definitions.xml).toBe('eXtensible Markup Language');
      expect(result.definitions.json).toBe('JavaScript Object Notation');
      expect(result.definitions.api).toBe('Application Programming Interface');
      expect(result.referencePages.json).toBe(5);
      expect(result.paragraphs).toHaveLength(2);
    });

    it('should create lookup tables and relationships', () => {
      const xml = `
        <data>
          <users>
            <user id="u1">
              <name>Alice</name>
              <department>d1</department>
            </user>
            <user id="u2">
              <name>Bob</name>
              <department>d2</department>
            </user>
            <user id="u3">
              <name>Charlie</name>
              <department>d1</department>
            </user>
          </users>
          <departments>
            <department id="d1">
              <name>Engineering</name>
              <manager>u1</manager>
            </department>
            <department id="d2">
              <name>Sales</name>
              <manager>u2</manager>
            </department>
          </departments>
          <projects>
            <project id="p1">
              <name>Project Alpha</name>
              <owner>u1</owner>
              <members>u1,u3</members>
            </project>
            <project id="p2">
              <name>Project Beta</name>
              <owner>u2</owner>
              <members>u2</members>
            </project>
          </projects>
        </data>
      `;

      const schema = x.object({
        users: x.array(
          x.object({
            id: x.string().xpath('./@id'),
            name: x.string().xpath('./name/text()'),
            departmentId: x.string().xpath('./department/text()')
          }),
          '//users/user'
        ),
        departments: x.array(
          x.object({
            id: x.string().xpath('./@id'),
            name: x.string().xpath('./name/text()'),
            managerId: x.string().xpath('./manager/text()')
          }),
          '//departments/department'
        ),
        projects: x.array(
          x.object({
            id: x.string().xpath('./@id'),
            name: x.string().xpath('./name/text()'),
            ownerId: x.string().xpath('./owner/text()'),
            memberIds: x.string().xpath('./members/text()').transform(members => members.split(','))
          }),
          '//projects/project'
        )
      }).transform(data => {
        // Create lookup maps
        const userMap = data.users.reduce((acc, user) => {
          acc[user.id] = user;
          return acc;
        }, {} as Record<string, {
          id: string;
          name: string;
          departmentId: string;
        }>);

        const deptMap = data.departments.reduce((acc, dept) => {
          acc[dept.id] = dept;
          return acc;
        }, {} as Record<string, {
          id: string;
          name: string;
          managerId: string;
        }>);

        // Resolve relationships
        const usersWithDepts = data.users.map(user => ({
          ...user,
          department: deptMap[user.departmentId]
        }));

        const deptsWithManagers = data.departments.map(dept => ({
          ...dept,
          manager: userMap[dept.managerId],
          employees: usersWithDepts.filter(u => u.departmentId === dept.id)
        }));

        const projectsWithMembers = data.projects.map(project => ({
          ...project,
          owner: userMap[project.ownerId],
          members: project.memberIds.map((id: string) => userMap[id])
        }));

        return {
          users: usersWithDepts,
          departments: deptsWithManagers,
          projects: projectsWithMembers
        };
      });

      const result = schema.parseSync(xml);

      expect(result.users[0].department.name).toBe('Engineering');
      expect(result.departments[0].manager.name).toBe('Alice');
      expect(result.departments[0].employees).toHaveLength(2);
      expect(result.projects[0].members).toHaveLength(2);
      expect(result.projects[0].members[0].name).toBe('Alice');

    });
  });

  describe('Complex Data Aggregations', () => {
    it('should aggregate and analyze data from multiple paths', () => {
      const xml = `
        <analytics>
          <events>
            <event type="page_view" timestamp="1640995200">
              <user>u1</user>
              <page>/home</page>
            </event>
            <event type="click" timestamp="1640995260">
              <user>u1</user>
              <element>button-signup</element>
            </event>
            <event type="page_view" timestamp="1640995320">
              <user>u2</user>
              <page>/pricing</page>
            </event>
          </events>
          <users>
            <user id="u1">
              <segment>premium</segment>
              <country>US</country>
            </user>
            <user id="u2">
              <segment>free</segment>
              <country>UK</country>
            </user>
          </users>
        </analytics>
      `;

      const schema = x.object({
        // Event aggregations
        totalEvents: x.array(x.string(), '//event/@type').transform(types => types.length),
        eventTypes: x.array(x.string(), '//event/@type').transform(types => [...new Set(types)]),
        pageViews: x.array(
          x.object({
            user: x.string().xpath('./user'),
            page: x.string().xpath('./page')
          }),
          "//event[@type='page_view']"
        ),
        clicks: x.array(
          x.object({
            user: x.string().xpath('./user'),
            element: x.string().xpath('./element')
          }),
          "//event[@type='click']"
        ),
        // User data
        users: x.array(
          x.object({
            id: x.string().xpath('./@id'),
            segment: x.string().xpath('./segment'),
            country: x.string().xpath('./country')
          }),
          '//user'
        ),
        // Cross-references
        userEvents: x.array(x.string(), '//event/user').transform(users => [...new Set(users)])
      }).transform(data => {
        const userMap = data.users.reduce((acc, user) => {
          acc[user.id] = user;
          return acc;
        }, {} as Record<string, any>);

        const enrichedPageViews = data.pageViews.map(pv => ({
          ...pv,
          userInfo: userMap[pv.user]
        }));

        const enrichedClicks = data.clicks.map(click => ({
          ...click,
          userInfo: userMap[click.user]
        }));

        const analytics = {
          summary: {
            totalEvents: data.totalEvents,
            eventTypes: data.eventTypes,
            activeUsers: data.userEvents.length
          },
          pageViews: enrichedPageViews,
          clicks: enrichedClicks,
          segmentAnalysis: {
            premium: {
              pageViews: enrichedPageViews.filter(pv => pv.userInfo?.segment === 'premium').length,
              clicks: enrichedClicks.filter(c => c.userInfo?.segment === 'premium').length
            },
            free: {
              pageViews: enrichedPageViews.filter(pv => pv.userInfo?.segment === 'free').length,
              clicks: enrichedClicks.filter(c => c.userInfo?.segment === 'free').length
            }
          },
          countryAnalysis: data.users.reduce((acc, user) => {
            if (!acc[user.country]) acc[user.country] = 0;
            acc[user.country]++;
            return acc;
          }, {} as Record<string, number>)
        };

        return analytics;
      });

      const result = schema.parseSync(xml);

      expect(result.summary.totalEvents).toBe(3);
      expect(result.summary.eventTypes).toEqual(['page_view', 'click']);
      expect(result.pageViews).toHaveLength(2);
      expect(result.pageViews[0].userInfo.segment).toBe('premium');
      expect(result.segmentAnalysis.premium.pageViews).toBe(1);
      expect(result.countryAnalysis.US).toBe(1);
      expect(result.countryAnalysis.UK).toBe(1);
    });
  });
});